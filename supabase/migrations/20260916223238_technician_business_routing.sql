-- Owner-friendly technician setup and default routing. Apply locally/staging first.
begin;
create table public.business_technicians (
 organization_id uuid primary key references public.organizations on delete cascade,
 technician_id uuid not null references public.profiles,
 updated_at timestamptz not null default clock_timestamp()
);
create index business_technicians_technician on public.business_technicians(technician_id);
alter table public.business_technicians enable row level security;
revoke all on public.business_technicians from public, anon, authenticated;
grant select on public.business_technicians to authenticated;
grant all on public.business_technicians to service_role;
create policy routing_read on public.business_technicians for select to authenticated
 using ((select private.actor_role()) in ('owner','dispatcher'));

create function private.connect_businesses(tech_id uuid, business_ids uuid[], retry_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare fingerprint text; receipt private.command_receipts; result jsonb; before_rows jsonb;
begin
 if auth.uid() is null or coalesce(private.actor_role(),'') not in ('owner','dispatcher') then raise exception 'Dispatcher access required.' using errcode='42501'; end if;
 if retry_key is null or business_ids is null or cardinality(business_ids)>100 then raise exception 'Select up to 100 businesses.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||retry_key::text,0));
 fingerprint:=md5('connect_businesses'||tech_id::text||to_jsonb(business_ids)::text);
 select * into receipt from private.command_receipts where actor_id=auth.uid() and key=retry_key;
 if found then
  if receipt.fingerprint<>fingerprint then raise exception 'This retry key was already used for a different operation.'; end if;
  return receipt.result;
 end if;
 if not exists(select 1 from public.profiles where id=tech_id and role in ('technician','dispatcher')) then raise exception 'Technician unavailable.'; end if;
 if not exists(select 1 from public.profiles where id=tech_id and role='technician' and active) and exists(select 1 from unnest(business_ids) b where not exists(select 1 from public.business_technicians r where r.organization_id=b and r.technician_id=tech_id)) then raise exception 'Choose an active technician for new connections.'; end if;
 if exists(select 1 from unnest(business_ids) b where b is null or not exists(select 1 from public.organizations o where o.id=b)) then raise exception 'Business unavailable.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('net-tech-business-routing',0));
 select coalesce(jsonb_agg(to_jsonb(b)),'[]') into before_rows from public.business_technicians b where technician_id=tech_id or organization_id=any(business_ids);
 delete from public.business_technicians where technician_id=tech_id and not (organization_id=any(business_ids));
 insert into public.business_technicians(organization_id,technician_id)
 select distinct b,tech_id from unnest(business_ids) b
 on conflict(organization_id) do update set technician_id=excluded.technician_id,updated_at=clock_timestamp()
 where public.business_technicians.technician_id is distinct from excluded.technician_id;
 insert into private.audit_log(actor_id,action,record_id,before_data,after_data)
 values(auth.uid(),'business_connections',tech_id,before_rows,jsonb_build_object('business_ids',business_ids));
 result:=jsonb_build_object('id',tech_id);
 insert into private.command_receipts(actor_id,key,fingerprint,result) values(auth.uid(),retry_key,fingerprint,result);
 return result;
end $$;
create function public.connect_businesses(tech_id uuid,business_ids uuid[],retry_key uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.connect_businesses(tech_id,business_ids,retry_key) $$;

-- A connection routes new work only. Historical access remains assignment-based.
create function private.route_business_request() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.assignee_id is null then
  select b.technician_id into new.assignee_id from public.business_technicians b
  join public.profiles p on p.id=b.technician_id and p.active and p.role='technician'
  where b.organization_id=new.organization_id;
 end if;
 return new;
end $$;
create trigger route_business_request before insert on public.requests for each row execute function private.route_business_request();
create function private.record_business_routing() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.assignee_id is not null then
  perform private.event(new.id,'Technician assigned',auth.uid());
  insert into private.audit_log(actor_id,action,record_id,after_data) values(auth.uid(),'initial_assignment',new.id,jsonb_build_object('assignee_id',new.assignee_id));
 end if;
 return new;
end $$;
create trigger record_business_routing after insert on public.requests for each row execute function private.record_business_routing();

-- Trusted invitation metadata; never authorize using Auth user_metadata.
alter table private.invitations add column technician_setup jsonb;
create function private.prepare_technician_invitation(token_hash text,target_email text,display_name text,contact_phone text,business_ids uuid[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare invitation_id uuid; expected jsonb;
begin
 if auth.uid() is null or private.actor_role() is distinct from 'owner' then raise exception 'Owner access required.' using errcode='42501'; end if;
 if length(trim(display_name)) not between 1 and 120 or display_name is null or length(contact_phone)>40 or contact_phone is null or business_ids is null or cardinality(business_ids)>100 then raise exception 'Add a name and valid contact details.'; end if;
 if target_email is null or target_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address.'; end if;
 if exists(select 1 from public.profiles where lower(email)=lower(trim(target_email)) and (role in ('owner','technician','dispatcher') or not active or exists(select 1 from public.memberships m where m.user_id=public.profiles.id))) then raise exception 'This person already has an account. Manage their access in Team.'; end if;
 if exists(select 1 from unnest(business_ids) b where b is null or not exists(select 1 from public.organizations o where o.id=b)) then raise exception 'Business unavailable.'; end if;
 -- Lock invitation rows before the routing lock, matching acceptance order.
 update private.invitations set expires_at=now() where email=lower(trim(target_email)) and accepted_at is null and technician_setup is not null;
 invitation_id:=private.create_invitation(token_hash,target_email,'technician',null);
 perform pg_advisory_xact_lock(hashtextextended('net-tech-business-routing',0));
 select coalesce(jsonb_object_agg(b::text,coalesce((select to_jsonb(r) from public.business_technicians r where r.organization_id=b),'null'::jsonb)),'{}') into expected from unnest(business_ids) b;
 update private.invitations set technician_setup=jsonb_build_object('name',trim(display_name),'phone',contact_phone,'business_ids',business_ids,'expected',expected) where id=invitation_id;
 return invitation_id;
end $$;
create function public.prepare_technician_invitation(token_hash text,target_email text,display_name text,contact_phone text,business_ids uuid[]) returns uuid
language sql security invoker set search_path='' as $$ select private.prepare_technician_invitation(token_hash,target_email,display_name,contact_phone,business_ids) $$;

create function private.finish_technician_setup() returns trigger language plpgsql security definer set search_path='' as $$
declare business text; current_route jsonb; connected uuid[]:='{}';
begin
 if old.accepted_at is null and new.accepted_at is not null and new.role='technician' and new.technician_setup is not null then
  if auth.uid() is null or new.accepted_by is distinct from auth.uid() then raise exception 'Invitation identity mismatch.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('net-tech-business-routing',0));
  update public.profiles set name=new.technician_setup->>'name',phone=new.technician_setup->>'phone' where id=new.accepted_by;
  for business in select jsonb_array_elements_text(new.technician_setup->'business_ids') loop
   select to_jsonb(r) into current_route from public.business_technicians r where organization_id=business::uuid;
   -- Never overwrite a newer business connection made after the invitation.
   if coalesce(current_route,'null'::jsonb)=new.technician_setup->'expected'->business then
    insert into public.business_technicians(organization_id,technician_id) values(business::uuid,new.accepted_by)
    on conflict(organization_id) do update set technician_id=excluded.technician_id,updated_at=clock_timestamp();
    connected:=array_append(connected,business::uuid);
   end if;
  end loop;
  insert into private.audit_log(actor_id,action,record_id,after_data) values(auth.uid(),'technician_setup_accepted',new.accepted_by,jsonb_build_object('connected_business_ids',connected,'requested_business_ids',new.technician_setup->'business_ids'));
 end if;
 return new;
end $$;
create trigger finish_technician_setup after update on private.invitations for each row execute function private.finish_technician_setup();

create function private.pending_technicians() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or private.actor_role() is distinct from 'owner' then raise exception 'Owner access required.' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(item),'[]') from (
  select jsonb_build_object('id',id,'email',email,'name',technician_setup->>'name','phone',technician_setup->>'phone','business_ids',technician_setup->'business_ids','expires_at',expires_at) item
  from private.invitations where technician_setup is not null and accepted_at is null and expires_at>now() order by expires_at desc limit 100
 ) pending);
end $$;
create function public.pending_technicians() returns jsonb language sql security invoker set search_path='' as $$ select private.pending_technicians() $$;

revoke all on function private.connect_businesses(uuid,uuid[],uuid),private.route_business_request(),private.record_business_routing(),private.prepare_technician_invitation(text,text,text,text,uuid[]),private.finish_technician_setup(),private.pending_technicians() from public,anon,authenticated;
revoke all on function public.connect_businesses(uuid,uuid[],uuid),public.prepare_technician_invitation(text,text,text,text,uuid[]),public.pending_technicians() from public,anon;
grant execute on function private.connect_businesses(uuid,uuid[],uuid),private.prepare_technician_invitation(text,text,text,text,uuid[]),private.pending_technicians(),public.connect_businesses(uuid,uuid[],uuid),public.prepare_technician_invitation(text,text,text,text,uuid[]),public.pending_technicians() to authenticated;
-- Advisor findings: evaluate caller identity once per statement, not per row.
alter policy membership_read on public.memberships using ((select private.actor_role()) is not null and (user_id=(select auth.uid()) or (select private.actor_role()) in ('owner','dispatcher')));
alter policy availability_read on public.availability using ((select private.actor_role()) is not null and (user_id=(select auth.uid()) or (select private.actor_role()) in ('owner','dispatcher')));
alter policy notification_read on public.notifications using (user_id=(select auth.uid()) and private.can_read(request_id));
alter policy cursor_read on public.read_cursors using (user_id=(select auth.uid()) and private.can_read(request_id));
commit;

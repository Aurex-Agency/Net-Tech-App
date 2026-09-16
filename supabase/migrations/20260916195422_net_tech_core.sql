-- Net-Tech Connect: review locally/staging before applying to the hosted project.
-- No demo users, owner bootstrap, production invitations, or provider credentials.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table public.profiles (
 id uuid primary key references auth.users(id), name text not null check(length(name) between 1 and 120),
 email text not null, phone text not null default '', role text not null default 'client' check(role in ('client','client_admin','technician','dispatcher','owner')),
 working_start time,working_end time,working_days integer[],
 active boolean not null default true, email_notifications boolean not null default true, created_at timestamptz not null default now()
);
create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 160), tags text[] not null default '{}');
create table public.memberships (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles, organization_id uuid not null references public.organizations, admin boolean not null default false, active boolean not null default true, unique(user_id,organization_id));
create table public.locations (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations, name text not null, address text not null, contact_name text not null default '', contact_phone text not null default '', services text[] not null default '{}', unique(id,organization_id));
create table private.site_notes (location_id uuid primary key references public.locations, summary text not null default '', management_url text);
create sequence public.request_reference_seq start 10042;
create table public.requests (
 id uuid primary key default gen_random_uuid(), reference text not null unique default ('NT-'||nextval('public.request_reference_seq')),
 organization_id uuid not null references public.organizations, location_id uuid not null, created_by uuid not null references public.profiles, assignee_id uuid references public.profiles,
 kind text not null check(kind in ('support','estimate','general')), title text not null check(length(title) between 5 and 160), description text not null check(length(description) between 10 and 10000),
 category text not null default 'Other / Not sure', impact text not null default 'One person affected', status text not null default 'new' check(status in ('new','triaged','in_progress','waiting_client','waiting_vendor','resolved','closed','canceled')),
 priority text not null default 'normal' check(priority in ('low','normal','high','urgent')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 resolved_at timestamptz, closed_at timestamptz, reopen_count integer not null default 0, completion_summary text, intake_channel text not null default 'portal' check(intake_channel in ('portal','phone','public_estimate')),
 preferences text[] not null default '{}' check(cardinality(preferences)<=3), contact_name text not null default '', contact_phone text not null default '', target_date date, budget text not null default '', started_at text not null default '', linked_request_id uuid references public.requests,
 foreign key(location_id,organization_id) references public.locations(id,organization_id)
);
create table public.participants (request_id uuid references public.requests on delete cascade, user_id uuid references public.profiles, primary key(request_id,user_id));
create table public.collaborators (request_id uuid references public.requests on delete cascade, user_id uuid references public.profiles, primary key(request_id,user_id));
create table public.messages (id uuid primary key default gen_random_uuid(), request_id uuid not null references public.requests, author_id uuid not null references public.profiles, body text not null check(length(body) between 1 and 10000), created_at timestamptz not null default now());
create table public.notes (id uuid primary key default gen_random_uuid(), request_id uuid not null references public.requests, author_id uuid not null references public.profiles, body text not null check(length(body) between 1 and 10000), created_at timestamptz not null default now(), unique(id,request_id));
create table public.appointments (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.requests, technician_id uuid not null references public.profiles, starts_at timestamptz not null, ends_at timestamptz not null,
 timezone text not null default 'America/Chicago' check(timezone='America/Chicago'), status text not null default 'proposed' check(status in ('proposed','confirmed','en_route','on_site','completed','canceled','no_show')),
 purpose text not null check(length(purpose) between 1 and 160), preparation text not null default '', summary text not null default '', tasks jsonb not null default '[]', change_requested text, version integer not null default 1, buffer_minutes integer not null default 15 check(buffer_minutes between 0 and 120), check(ends_at>starts_at and ends_at<=starts_at+interval '24 hours')
);
create table public.availability (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles, starts_at timestamptz not null, ends_at timestamptz not null, note text not null default '', status text not null default 'pending' check(status in ('pending','approved','declined')), check(ends_at>starts_at));
create table public.work_entries (id uuid primary key default gen_random_uuid(), request_id uuid not null references public.requests, author_id uuid not null references public.profiles, date date not null, minutes integer not null check(minutes between 1 and 1440), description text not null check(length(description) between 1 and 2000), materials text not null default '');
create table public.attachments (id uuid primary key default gen_random_uuid(), request_id uuid not null references public.requests, note_id uuid, name text not null check(length(name)<=160), object_key text not null unique, mime text not null check(mime in ('image/jpeg','image/png','image/webp','application/pdf')), size integer not null check(size between 1 and 10485760), uploaded_by uuid not null references public.profiles, created_at timestamptz not null default now(), foreign key(note_id,request_id) references public.notes(id,request_id));
create table public.events (id uuid primary key default gen_random_uuid(), request_id uuid not null references public.requests, actor_id uuid references public.profiles, label text not null, created_at timestamptz not null default now());
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles, request_id uuid not null references public.requests, title text not null, created_at timestamptz not null default now(), read_at timestamptz);
create table public.read_cursors (request_id uuid references public.requests, user_id uuid references public.profiles, read_at timestamptz not null, primary key(request_id,user_id));
create table public.settings (id boolean primary key default true check(id), data jsonb not null);
insert into public.settings(data) values ('{"company_name":"Net-Tech Connect","support_phone":"+1-662-539-7787","support_email":"","categories":["Internet / Wi-Fi","Network equipment","Computers / IT support","Email / Cloud services","Security cameras","Other / Not sure"],"duration_minutes":60,"buffer_minutes":15,"closure_days":7,"auto_close":false,"working_start":"08:00","working_end":"17:00","service_area":"North Mississippi","require_staff_mfa":false}');
create table private.audit_log (id uuid primary key default gen_random_uuid(), actor_id uuid, action text not null, record_id uuid, before_data jsonb, after_data jsonb, reason text, created_at timestamptz not null default now());
create table private.command_receipts (actor_id uuid not null, key uuid not null, fingerprint text not null, result jsonb not null, created_at timestamptz not null default now(), primary key(actor_id,key));
create table private.rate_limits (bucket text primary key, window_start timestamptz not null, count integer not null);
create table private.invitations (id uuid primary key default gen_random_uuid(), token_hash text not null unique, email text not null, role text not null check(role in ('client','client_admin','technician','dispatcher')), organization_id uuid references public.organizations, expires_at timestamptz not null, accepted_at timestamptz, accepted_by uuid references public.profiles, created_by uuid references public.profiles, check((role in ('client','client_admin'))=(organization_id is not null)));
create table private.outbox (id uuid primary key default gen_random_uuid(), dedup_key text not null unique, request_id uuid not null references public.requests, recipient_id uuid not null references public.profiles, kind text not null, appointment_id uuid references public.appointments, appointment_version integer, due_at timestamptz not null default now(), status text not null default 'pending' check(status in ('pending','processing','sent','canceled','failed')), attempts integer not null default 0, locked_at timestamptz, first_attempt_at timestamptz, lease_token uuid, last_error text, created_at timestamptz not null default now());
create table private.delivery_attempts (id uuid primary key default gen_random_uuid(), outbox_id uuid not null references private.outbox, attempted_at timestamptz not null default now(), ok boolean not null, error_code text);
create table private.public_inquiries (id uuid primary key, name text not null, email text not null, phone text not null default '', organization text not null, address text not null, description text not null, preferences text[] not null default '{}', created_at timestamptz not null default now(), converted_request_id uuid references public.requests);

create index requests_organization_status on public.requests(organization_id,status,created_at desc);
create index requests_assignee_status on public.requests(assignee_id,status);
create index requests_creator on public.requests(created_by);
create index memberships_org on public.memberships(organization_id,user_id) where active;
create index locations_org on public.locations(organization_id);
create index participants_user on public.participants(user_id,request_id);
create index collaborators_user on public.collaborators(user_id,request_id);
create index messages_request_created on public.messages(request_id,created_at,id);
create index notes_request_created on public.notes(request_id,created_at,id);
create index appointments_technician_time on public.appointments(technician_id,starts_at,ends_at);
create index appointments_request on public.appointments(request_id);
create index availability_user_time on public.availability(user_id,starts_at,ends_at);
create index attachments_parent on public.attachments(request_id,note_id);
create index work_entries_parent on public.work_entries(request_id,author_id);
create index notifications_recipient on public.notifications(user_id,created_at desc);
create index events_request on public.events(request_id,created_at);
create index outbox_due on private.outbox(status,due_at);

-- Membership lookups must not recurse through RLS. These narrow helpers use a fixed
-- empty search path; current identity is always auth.uid(), never profile metadata.
create function private.actor_role() returns text language sql stable security definer set search_path='' as $$
 select p.role from public.profiles p where p.id=auth.uid() and p.active
 and (p.role not in ('technician','dispatcher','owner') or not coalesce((select (data->>'require_staff_mfa')::boolean from public.settings where id),false) or auth.jwt()->>'aal'='aal2')
$$;
create function private.can_read_as(rid uuid, who uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.requests r join public.profiles p on p.id=who and p.active where r.id=rid and (
 p.role in ('owner','dispatcher') or (p.role='technician' and (r.assignee_id=who or exists(select 1 from public.collaborators c where c.request_id=r.id and c.user_id=who)))
 or (p.role in ('client','client_admin') and exists(select 1 from public.memberships m where m.user_id=who and m.organization_id=r.organization_id and m.active and (m.admin or r.created_by=who or exists(select 1 from public.participants x where x.request_id=r.id and x.user_id=who))))))
$$;
create function private.can_read(rid uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.actor_role() is not null and private.can_read_as(rid,auth.uid()) $$;
create function private.can_location(lid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.actor_role() is not null and exists(select 1 from public.locations l where l.id=lid and (private.actor_role() in ('owner','dispatcher') or (private.actor_role() in ('client','client_admin') and exists(select 1 from public.memberships m where m.organization_id=l.organization_id and m.user_id=auth.uid() and m.active)) or exists(select 1 from public.requests r where r.location_id=l.id and private.can_read(r.id))))
$$;
create function private.visible_profile(who uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.actor_role() is not null and (who=auth.uid() or private.actor_role() in ('owner','dispatcher') or exists(select 1 from public.requests r where private.can_read(r.id) and (r.assignee_id=who or r.created_by=who or exists(select 1 from public.messages m where m.request_id=r.id and m.author_id=who))) or (private.actor_role()='technician' and exists(select 1 from public.profiles p where p.id=who and p.role in ('owner','dispatcher','technician'))))
$$;
-- Profiles returned to clients contain only display identity, not colleagues' email/phone.
create view public.directory with(security_invoker=true) as select id,name,role,active from public.profiles;
create view public.staff_memberships with(security_invoker=true) as select id user_id,role,active from public.profiles where role in ('owner','dispatcher','technician');

-- API clients get read-only access. All writes go through the validated transaction
-- below; a raw PostgREST PATCH cannot change membership, audience or assignment.
do $$ declare t text; begin
 foreach t in array array['profiles','organizations','memberships','locations','requests','participants','collaborators','messages','notes','appointments','availability','work_entries','attachments','events','notifications','read_cursors','settings'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
 foreach t in array array['site_notes','audit_log','command_receipts','rate_limits','invitations','outbox','delivery_attempts','public_inquiries'] loop execute format('alter table private.%I enable row level security',t);end loop;
end $$;
revoke all on public.directory,public.staff_memberships from anon;
grant select on public.directory,public.staff_memberships to authenticated;
create policy profile_read on public.profiles for select to authenticated using(private.visible_profile(id));
create policy organization_read on public.organizations for select to authenticated using(private.actor_role() is not null and (private.actor_role() in ('owner','dispatcher') or exists(select 1 from public.locations l where l.organization_id=public.organizations.id and private.can_location(l.id))));
create policy membership_read on public.memberships for select to authenticated using(private.actor_role() is not null and (user_id=auth.uid() or private.actor_role() in ('owner','dispatcher')));
create policy location_read on public.locations for select to authenticated using(private.can_location(id));
create policy request_read on public.requests for select to authenticated using(private.can_read(id));
create policy participant_read on public.participants for select to authenticated using(private.can_read(request_id));
create policy collaborator_read on public.collaborators for select to authenticated using(private.can_read(request_id) and private.actor_role() in ('owner','dispatcher','technician'));
create policy message_read on public.messages for select to authenticated using(private.can_read(request_id));
create policy note_read on public.notes for select to authenticated using(private.can_read(request_id) and private.actor_role() in ('owner','dispatcher','technician'));
create policy appointment_read on public.appointments for select to authenticated using(private.can_read(request_id));
create policy availability_read on public.availability for select to authenticated using(private.actor_role() is not null and (user_id=auth.uid() or private.actor_role() in ('owner','dispatcher')));
create policy work_read on public.work_entries for select to authenticated using(private.can_read(request_id) and private.actor_role() in ('owner','dispatcher','technician'));
create policy attachment_read on public.attachments for select to authenticated using(private.can_read(request_id) and (note_id is null or private.actor_role() in ('owner','dispatcher','technician')));
create policy event_read on public.events for select to authenticated using(private.can_read(request_id));
create policy notification_read on public.notifications for select to authenticated using(user_id=auth.uid() and private.can_read(request_id));
create policy cursor_read on public.read_cursors for select to authenticated using(user_id=auth.uid() and private.can_read(request_id));
create policy settings_read on public.settings for select to authenticated using(private.actor_role() is not null);

create function private.throttle(bucket_key text, maximum integer, seconds integer) returns void language plpgsql security definer set search_path='' as $$
 declare n integer; begin
 insert into private.rate_limits(bucket,window_start,count) values(bucket_key,now(),1)
 on conflict(bucket) do update set count=case when private.rate_limits.window_start<now()-make_interval(secs=>seconds) then 1 else private.rate_limits.count+1 end, window_start=case when private.rate_limits.window_start<now()-make_interval(secs=>seconds) then now() else private.rate_limits.window_start end returning count into n;
 if n>maximum then raise exception 'Too many attempts. Please wait before trying again.' using errcode='P0001';end if;
 end $$;
create function private.notify(rid uuid, event_key uuid, kind text, actor uuid) returns void language plpgsql security definer set search_path='' as $$
 declare recipient record; begin
 for recipient in select p.id,p.email_notifications from public.profiles p where p.active and p.id is distinct from actor and private.can_read_as(rid,p.id) loop
 insert into public.notifications(user_id,request_id,title) values(recipient.id,rid,kind);
 if recipient.email_notifications then insert into private.outbox(dedup_key,request_id,recipient_id,kind) values(event_key||':'||recipient.id,rid,recipient.id,kind) on conflict(dedup_key) do nothing;end if;
 end loop;end $$;
create function private.event(rid uuid, label text, actor uuid) returns void language sql security definer set search_path='' as $$ insert into public.events(request_id,actor_id,label) values(rid,actor,label) $$;

create function private.command(action_type text, record_id uuid, idempotency_key uuid, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
 declare uid uuid:=auth.uid(); actor text:=private.actor_role(); r public.requests; a public.appointments; old_a jsonb; cfg jsonb; result jsonb; receipt private.command_receipts; fingerprint text; lid uuid; org uuid; staff_id uuid; start_time timestamptz; end_time timestamptz; requested_status text; window_days integer; clash boolean; override_text text; new_id uuid; target public.profiles; block public.availability; vrole text; inv private.invitations;
 begin
 if uid is null or actor is null then raise exception 'Active membership and required authentication are needed.' using errcode='42501';end if;
 if idempotency_key is null then raise exception 'Idempotency key required';end if;
 -- Locks are ordered consistently: idempotency, global schedule, then request row.
 perform pg_advisory_xact_lock(hashtextextended(uid::text||idempotency_key::text,0));
 fingerprint:=md5(action_type||coalesce(record_id::text,'')||payload::text);
 select * into receipt from private.command_receipts where actor_id=uid and key=idempotency_key;
 if found then if receipt.fingerprint<>fingerprint then raise exception 'This retry key was already used for a different operation.';end if;return receipt.result;end if;
 perform private.throttle(uid::text||':'||action_type,case when action_type='read' then 180 else 60 end,60);
 select data into cfg from public.settings where id;
 if action_type in ('schedule','visit','review_availability','employee') then lock table public.appointments in share row exclusive mode;end if;
 if action_type in ('reply','note','read','update_request','client_action','schedule','work_entry','attachment','share') then
 select * into r from public.requests where id=record_id for update;
 if not found or not private.can_read_as(record_id,uid) then raise exception 'Request unavailable.' using errcode='42501';end if;
 end if;
 if action_type='create_request' then
 lid:=(payload->>'location_id')::uuid;
 select organization_id into org from public.locations where id=lid;
 if org is null or not (actor in ('owner','dispatcher') or exists(select 1 from public.memberships m where m.user_id=uid and m.organization_id=org and m.active)) then raise exception 'Location access denied.' using errcode='42501';end if;
 if nullif(payload->>'linked_request_id','') is not null and not private.can_read_as((payload->>'linked_request_id')::uuid,uid) then raise exception 'Linked request unavailable.';end if;
 insert into public.requests(id,organization_id,location_id,created_by,kind,title,description,category,impact,contact_name,contact_phone,preferences,target_date,budget,started_at,linked_request_id,intake_channel)
 values(idempotency_key,org,lid,uid,coalesce(payload->>'kind','support'),trim(payload->>'title'),trim(payload->>'description'),coalesce(payload->>'category','Other / Not sure'),coalesce(payload->>'impact','One person affected'),coalesce(payload->>'contact_name',''),coalesce(payload->>'contact_phone',''),array(select jsonb_array_elements_text(coalesce(payload->'preferences','[]'))),nullif(payload->>'target_date','')::date,coalesce(payload->>'budget',''),coalesce(payload->>'started_at',''),nullif(payload->>'linked_request_id','')::uuid,case when actor in ('owner','dispatcher') then 'phone' else 'portal' end) returning id into record_id;
 perform private.event(record_id,'Request received',uid);perform private.notify(record_id,idempotency_key,'New service request',uid);
 -- Receipt email contains only a secure link; authored-action notifications are suppressed.
 insert into private.outbox(dedup_key,request_id,recipient_id,kind) select idempotency_key||':receipt',record_id,uid,'Request received' from public.profiles where id=uid and email_notifications;
 elsif action_type in ('reply','note') then
 if r.status in ('closed','canceled') then raise exception 'Create a linked follow-up for this archived request.';end if;
 if action_type='note' then
 if actor not in ('owner','dispatcher','technician') then raise exception 'Staff access required.' using errcode='42501';end if;
 insert into public.notes(id,request_id,author_id,body) values(idempotency_key,record_id,uid,trim(payload->>'body'));
 -- No public events or client notifications for internal notes.
 else
 if r.status='resolved' then
 window_days:=(cfg->>'closure_days')::integer;
 if r.resolved_at<now()-make_interval(days=>window_days) then raise exception 'The reply window ended. Create a linked follow-up request.';end if;
 update public.requests set status='in_progress',reopen_count=reopen_count+1 where id=record_id;
 perform private.event(record_id,'Request reopened',uid);
 end if;
 insert into public.messages(id,request_id,author_id,body) values(idempotency_key,record_id,uid,trim(payload->>'body'));
 if actor in ('client','client_admin') and r.status='waiting_client' then update public.requests set status='in_progress' where id=record_id;end if;
 update public.requests set updated_at=now() where id=record_id;
 perform private.notify(record_id,idempotency_key,'New reply on a service request',uid);
 end if;
 elsif action_type='read' then
 insert into public.read_cursors(request_id,user_id,read_at) values(record_id,uid,now()) on conflict(request_id,user_id) do update set read_at=excluded.read_at;
 update public.notifications set read_at=now() where request_id=record_id and user_id=uid and read_at is null;
 elsif action_type='update_request' then
 if actor not in ('owner','dispatcher','technician') then raise exception 'Staff access required.' using errcode='42501';end if;
 if r.status in ('closed','canceled') then raise exception 'Archived requests cannot be changed.';end if;
 if payload ?| array['priority','assignee_id','kind','target_date'] and actor not in ('owner','dispatcher') then raise exception 'Dispatch access required.' using errcode='42501';end if;
 requested_status:=coalesce(payload->>'status',r.status);
 if requested_status='closed' and r.status<>'resolved' then raise exception 'Resolve before closing.';end if;
 if requested_status='resolved' and nullif(trim(payload->>'completion_summary'),'') is null then raise exception 'A public completion summary is required.';end if;
 staff_id:=case when payload?'assignee_id' then nullif(payload->>'assignee_id','')::uuid else r.assignee_id end;
 if staff_id is not null and not exists(select 1 from public.profiles where id=staff_id and active and role in ('technician','dispatcher','owner')) then raise exception 'Assign an active staff member.';end if;
 update public.requests set status=requested_status, assignee_id=staff_id, priority=coalesce(payload->>'priority',priority),kind=coalesce(payload->>'kind',kind),target_date=case when payload?'target_date' then nullif(payload->>'target_date','')::date else target_date end,updated_at=now(),completion_summary=case when requested_status='resolved' then payload->>'completion_summary' else completion_summary end,resolved_at=case when requested_status='resolved' and r.status<>'resolved' then now() else resolved_at end,closed_at=case when requested_status='closed' then now() else closed_at end,reopen_count=reopen_count+case when r.status='resolved' and requested_status='in_progress' then 1 else 0 end where id=record_id;
 if requested_status='resolved' and r.status<>'resolved' then insert into public.messages(request_id,author_id,body) values(record_id,uid,payload->>'completion_summary');end if;
 insert into private.audit_log(actor_id,action,record_id,before_data,after_data) values(uid,action_type,record_id,to_jsonb(r),payload);
 perform private.event(record_id,case when staff_id is distinct from r.assignee_id then 'Responsible technician updated' else 'Request status updated' end,uid);
 perform private.notify(record_id,idempotency_key,case when requested_status='resolved' then 'Request resolved' else 'Service request updated' end,uid);
 elsif action_type='client_action' then
 if actor not in ('client','client_admin') then raise exception 'Client action required.';end if;
 if payload->>'action'='confirm' then
 if r.status<>'resolved' then raise exception 'Only a resolved request can be confirmed.';end if;
 update public.requests set status='closed',closed_at=now(),updated_at=now() where id=record_id;perform private.event(record_id,'Client confirmed the resolution',uid);
 else
 if r.status in ('closed','canceled') then raise exception 'Request is archived.';end if;
 insert into public.messages(id,request_id,author_id,body) values(idempotency_key,record_id,uid,'Please review my request to cancel this work.');
 perform private.event(record_id,'Cancellation requested; existing visits remain active',uid);
 end if;
 perform private.notify(record_id,idempotency_key,'Client response needs review',uid);
 elsif action_type='schedule' then
 if actor not in ('owner','dispatcher') then raise exception 'Dispatch access required.' using errcode='42501';end if;
 if r.status in ('closed','canceled') then raise exception 'Cannot schedule an archived request.';end if;
 new_id:=coalesce(nullif(payload->>'appointment_id','')::uuid,idempotency_key);
 select * into a from public.appointments where id=new_id for update;
 if found and (a.request_id<>record_id or a.version is distinct from (payload->>'version')::integer) then raise exception 'Appointment changed. Reload before editing.';end if;
 if a.id is not null and a.status in ('completed','canceled','no_show') then raise exception 'Completed or canceled visits cannot be rescheduled.';end if;
 old_a:=to_jsonb(a);staff_id:=(payload->>'technician_id')::uuid;start_time:=(payload->>'starts_at')::timestamptz;end_time:=(payload->>'ends_at')::timestamptz;requested_status:=payload->>'status';override_text:=nullif(trim(payload->>'override_reason'),'');
 if not exists(select 1 from public.profiles where id=staff_id and active and role in ('technician','dispatcher','owner')) then raise exception 'Select an active staff member.';end if;
 if not private.can_read_as(record_id,staff_id) then raise exception 'Assign this technician to the request or add them as a collaborator before booking.';end if;
 if requested_status not in ('proposed','confirmed','canceled') then raise exception 'Invalid booking status.';end if;
 if requested_status='confirmed' then
 select cfg||jsonb_build_object('working_start',coalesce(p.working_start::text,cfg->>'working_start'),'working_end',coalesce(p.working_end::text,cfg->>'working_end'),'working_days',coalesce(to_jsonb(p.working_days),'[1,2,3,4,5]'::jsonb)) into cfg from public.profiles p where p.id=staff_id;
 if exists(select 1 from public.availability b where b.user_id=staff_id and b.status='approved' and b.starts_at<end_time and b.ends_at>start_time) then raise exception 'Technician is unavailable during this time.';end if;
 select exists(select 1 from public.appointments v where v.id<>new_id and v.technician_id=staff_id and v.status in ('confirmed','en_route','on_site') and start_time<v.ends_at+make_interval(mins=>greatest(v.buffer_minutes,(cfg->>'buffer_minutes')::int)) and end_time+make_interval(mins=>greatest(v.buffer_minutes,(cfg->>'buffer_minutes')::int))>v.starts_at) into clash;
 if (clash or not (cfg->'working_days' @> to_jsonb(array[extract(isodow from start_time at time zone 'America/Chicago')::int])) or (start_time at time zone 'America/Chicago')::time<(cfg->>'working_start')::time or (end_time at time zone 'America/Chicago')::time>(cfg->>'working_end')::time or (start_time at time zone 'America/Chicago')::date<>(end_time at time zone 'America/Chicago')::date) and override_text is null then raise exception 'Booking conflicts with a visit, travel buffer, or working hours. Choose another time or record an override reason.';end if;
 end if;
 insert into public.appointments(id,request_id,technician_id,starts_at,ends_at,status,purpose,preparation,buffer_minutes)
 values(new_id,record_id,staff_id,start_time,end_time,requested_status,payload->>'purpose',coalesce(payload->>'preparation',''),(cfg->>'buffer_minutes')::int)
 on conflict(id) do update set technician_id=excluded.technician_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,status=excluded.status,purpose=excluded.purpose,preparation=excluded.preparation,buffer_minutes=excluded.buffer_minutes,version=public.appointments.version+1,change_requested=null returning * into a;
 update private.outbox set status='canceled',lease_token=null where appointment_id=new_id and status in ('pending','processing');
 insert into private.audit_log(actor_id,action,record_id,before_data,after_data,reason) values(uid,'schedule',new_id,old_a,to_jsonb(a),override_text);
 perform private.event(record_id,'Visit '||requested_status,uid);perform private.notify(record_id,idempotency_key,'Appointment updated',uid);
 if requested_status='confirmed' then
 insert into private.outbox(dedup_key,request_id,recipient_id,kind,appointment_id,appointment_version,due_at)
 select new_id||':'||a.version||':'||p.id,record_id,p.id,'Appointment reminder',new_id,a.version,greatest(now(),start_time-interval '24 hours') from public.profiles p where p.active and p.email_notifications and private.can_read_as(record_id,p.id) on conflict(dedup_key) do nothing;
 end if;
 elsif action_type='visit' then
 select * into a from public.appointments where id=record_id for update;
 if not found or not private.can_read_as(a.request_id,uid) then raise exception 'Visit unavailable.' using errcode='42501';end if;
 old_a:=to_jsonb(a);
 if payload?'change_requested' then
 if a.status in ('completed','canceled','no_show') then raise exception 'This visit is archived.';end if;
 update public.appointments set change_requested=left(payload->>'change_requested',1000) where id=record_id;
 perform private.event(a.request_id,'Appointment change requested; booking remains active',uid);
 else
 if actor not in ('owner','dispatcher') and not (actor='technician' and a.technician_id=uid) then raise exception 'Assigned technician required.' using errcode='42501';end if;
 requested_status:=payload->>'status';
 if not ((a.status='confirmed' and requested_status in ('en_route','canceled','no_show')) or (a.status='en_route' and requested_status in ('on_site','canceled')) or (a.status='on_site' and requested_status in ('completed','canceled'))) then raise exception 'Invalid visit status transition.';end if;
 if requested_status='completed' and nullif(trim(payload->>'summary'),'') is null then raise exception 'Public work summary required.';end if;
 update public.appointments set status=requested_status,summary=coalesce(payload->>'summary',''),tasks=coalesce(payload->'tasks',tasks),version=version+1 where id=record_id;
 if requested_status='completed' then insert into public.messages(id,request_id,author_id,body) values(idempotency_key,a.request_id,uid,'Visit completed: '||(payload->>'summary'));end if;
 update private.outbox set status='canceled',lease_token=null where appointment_id=record_id and status in ('pending','processing');
 perform private.event(a.request_id,'Visit '||replace(requested_status,'_',' '),uid);
 end if;
 insert into private.audit_log(actor_id,action,record_id,before_data,after_data) values(uid,'visit',record_id,old_a,payload);
 perform private.notify(a.request_id,idempotency_key,'Visit update',uid);
 elsif action_type='work_entry' then
 if actor not in ('owner','dispatcher','technician') then raise exception 'Staff access required.' using errcode='42501';end if;
 new_id:=coalesce(nullif(payload->>'entry_id','')::uuid,idempotency_key);
 if exists(select 1 from public.work_entries where id=new_id and (request_id<>record_id or (author_id<>uid and actor<>'owner'))) then raise exception 'You can edit only your own entries.';end if;
 insert into private.audit_log(actor_id,action,record_id,before_data,after_data) select uid,'work_entry',new_id,to_jsonb(w),payload from public.work_entries w where id=new_id;
 insert into public.work_entries(id,request_id,author_id,date,minutes,description,materials) values(new_id,record_id,uid,(payload->>'date')::date,(payload->>'minutes')::int,trim(payload->>'description'),coalesce(payload->>'materials','')) on conflict(id) do update set date=excluded.date,minutes=excluded.minutes,description=excluded.description,materials=excluded.materials;
 elsif action_type='availability' then
 if actor not in ('owner','dispatcher','technician') then raise exception 'Staff access required.';end if;
 insert into public.availability(id,user_id,starts_at,ends_at,note) values(idempotency_key,uid,(payload->>'starts_at')::timestamptz,(payload->>'ends_at')::timestamptz,left(coalesce(payload->>'note',''),300));
 elsif action_type='review_availability' then
 if actor not in ('owner','dispatcher') then raise exception 'Dispatch access required.';end if;
 select * into block from public.availability where id=record_id for update;
 if not found or payload->>'status' not in ('approved','declined') then raise exception 'Availability request unavailable.';end if;
 if payload->>'status'='approved' and exists(select 1 from public.appointments v where v.technician_id=block.user_id and v.status in ('confirmed','en_route','on_site') and v.starts_at<block.ends_at+make_interval(mins=>v.buffer_minutes) and v.ends_at+make_interval(mins=>v.buffer_minutes)>block.starts_at) then raise exception 'Reassign conflicting appointments before approving.';end if;
 update public.availability set status=payload->>'status' where id=record_id;
 insert into private.audit_log(actor_id,action,record_id,after_data) values(uid,action_type,record_id,payload);
 elsif action_type='employee' then
 if actor<>'owner' then raise exception 'Owner access required.' using errcode='42501';end if;
 select * into target from public.profiles where id=record_id for update;
 if not found or target.role not in ('technician','dispatcher') then raise exception 'Owner changes require a separate verified administrative process.';end if;
 if payload?'role' and payload->>'role' not in ('technician','dispatcher') then raise exception 'Only technician or dispatcher access can be granted here.';end if;
 update public.profiles set active=coalesce((payload->>'active')::boolean,active),role=coalesce(payload->>'role',role) where id=record_id;
 insert into private.audit_log(actor_id,action,record_id,before_data,after_data) values(uid,'employee_access',record_id,to_jsonb(target),payload);
 elsif action_type='staff_hours' then
 if actor not in ('owner','dispatcher') then raise exception 'Dispatch access required.';end if;
 if (payload->>'working_start')::time>=(payload->>'working_end')::time then raise exception 'Working hours must end after they start.';end if;
 if not exists(select 1 from public.profiles where id=record_id and role in ('owner','dispatcher','technician')) then raise exception 'Staff member unavailable.';end if;
 update public.profiles set working_start=(payload->>'working_start')::time,working_end=(payload->>'working_end')::time,working_days=array(select jsonb_array_elements_text(payload->'working_days')::integer) where id=record_id;
 if exists(select 1 from public.profiles where id=record_id and (cardinality(working_days)=0 or not working_days<@array[1,2,3,4,5,6,7])) then raise exception 'Choose valid working days.';end if;
 insert into private.audit_log(actor_id,action,record_id,after_data) values(uid,action_type,record_id,payload);
 elsif action_type='profile' then
 update public.profiles set name=left(trim(payload->>'name'),120),phone=left(coalesce(payload->>'phone',''),40),email_notifications=coalesce((payload->>'email_notifications')::boolean,true) where id=uid;
 elsif action_type='settings' then
 if actor<>'owner' then raise exception 'Owner access required.';end if;
 if (payload->>'duration_minutes')::int not between 15 and 480 or (payload->>'buffer_minutes')::int not between 0 and 120 or (payload->>'closure_days')::int not between 1 and 90 or (payload->>'working_start')::time>=(payload->>'working_end')::time or jsonb_array_length(payload->'categories') not between 1 and 30 then raise exception 'Check scheduling and category settings.';end if;
 -- Security settings cannot be relaxed through the UI.
 payload:=payload-'require_staff_mfa';
 update public.settings set data=data||payload where id;
 insert into private.audit_log(actor_id,action,before_data,after_data) values(uid,'settings',cfg,payload);
 elsif action_type='edit_organization' then
 if actor not in ('owner','dispatcher') then raise exception 'Dispatch access required.';end if;
 update public.organizations set name=payload->>'name',tags=array(select jsonb_array_elements_text(coalesce(payload->'tags','[]'))) where id=record_id;
 if not found then raise exception 'Organization unavailable.';end if;
 insert into private.audit_log(actor_id,action,record_id,after_data) values(uid,action_type,record_id,payload);
 elsif action_type='edit_location' then
 if actor not in ('owner','dispatcher') then raise exception 'Dispatch access required.';end if;
 update public.locations set name=payload->>'name',address=payload->>'address',contact_name=coalesce(payload->>'contact_name',''),contact_phone=coalesce(payload->>'contact_phone',''),services=array(select jsonb_array_elements_text(coalesce(payload->'services','[]'))) where id=record_id;
 if not found then raise exception 'Location unavailable.';end if;
 if nullif(payload->>'management_url','') is not null and payload->>'management_url' !~ '^https://' then raise exception 'Management links must use HTTPS.';end if;
 insert into private.site_notes(location_id,summary,management_url) values(record_id,left(coalesce(payload->>'site_summary',''),3000),nullif(payload->>'management_url','')) on conflict(location_id) do update set summary=excluded.summary,management_url=excluded.management_url;
 insert into private.audit_log(actor_id,action,record_id,after_data) values(uid,action_type,record_id,payload);
 elsif action_type='organization' then
 if actor not in ('owner','dispatcher') then raise exception 'Dispatch access required.';end if;
 insert into public.organizations(id,name) values(idempotency_key,payload->>'name') returning id into org;
 insert into public.locations(organization_id,name,address,contact_name,contact_phone) values(org,payload->>'location_name',payload->>'address',coalesce(payload->>'contact_name',''),coalesce(payload->>'contact_phone',''));record_id:=org;
 elsif action_type='location' then
 if actor not in ('owner','dispatcher') then raise exception 'Dispatch access required.';end if;
 insert into public.locations(id,organization_id,name,address,contact_name,contact_phone,services) values(idempotency_key,(payload->>'organization_id')::uuid,payload->>'name',payload->>'address',coalesce(payload->>'contact_name',''),coalesce(payload->>'contact_phone',''),array(select jsonb_array_elements_text(coalesce(payload->'services','[]'))));record_id:=idempotency_key;
 elsif action_type='share' then
 if actor not in ('owner','dispatcher') then raise exception 'Dispatch access required.';end if;
 staff_id:=(payload->>'user_id')::uuid;
 if payload->>'audience'='collaborator' then
 if not exists(select 1 from public.profiles where id=staff_id and active and role='technician') then raise exception 'Active technician required.';end if;
 if coalesce((payload->>'remove')::boolean,false) then delete from public.collaborators where request_id=record_id and user_id=staff_id;else insert into public.collaborators values(record_id,staff_id) on conflict do nothing;end if;
 else
 if not exists(select 1 from public.memberships where user_id=staff_id and organization_id=r.organization_id and active) then raise exception 'Active membership in the same organization required.';end if;
 if coalesce((payload->>'remove')::boolean,false) then delete from public.participants where request_id=record_id and user_id=staff_id;else insert into public.participants values(record_id,staff_id) on conflict do nothing;end if;
 end if;
 insert into private.audit_log(actor_id,action,record_id,after_data) values(uid,action_type,record_id,payload);
 elsif action_type='membership' then
 if actor not in ('owner','dispatcher') then raise exception 'Dispatch access required.';end if;
 update public.memberships set active=coalesce((payload->>'active')::boolean,active),admin=coalesce((payload->>'admin')::boolean,admin) where id=record_id;
 insert into private.audit_log(actor_id,action,record_id,after_data) values(uid,action_type,record_id,payload);
 else raise exception 'Unsupported action.';end if;
 result:=jsonb_build_object('id',coalesce(record_id,idempotency_key));
 insert into private.command_receipts(actor_id,key,fingerprint,result) values(uid,idempotency_key,fingerprint,result);return result;
 end $$;
create function public.command(action_type text, record_id uuid, idempotency_key uuid, payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.command(action_type,record_id,idempotency_key,payload) $$;

-- Attachment metadata is registered by a trusted server AFTER byte/signature validation.
-- The user-bound token and current access are still checked; no direct Storage writes.
create function private.register_attachment(who uuid, rid uuid, nid uuid, aid uuid, filename text, object_path text, mime_type text, bytes integer) returns void language plpgsql security definer set search_path='' as $$
 begin
 if not private.can_read_as(rid,who) or (nid is not null and not exists(select 1 from public.profiles where id=who and active and role in ('owner','dispatcher','technician'))) then raise exception 'Attachment access denied.';end if;
 perform private.throttle(who::text||':attachment',20,60);
 perform 1 from public.requests where id=rid for update;
 if (select count(*) from public.attachments where request_id=rid and uploaded_by=who)>49 then raise exception 'Attachment limit reached; contact Net-Tech.';end if;
 insert into public.attachments(id,request_id,note_id,name,object_key,mime,size,uploaded_by) values(aid,rid,nid,filename,object_path,mime_type,bytes,who);
 end $$;
create function public.register_attachment(who uuid, rid uuid, nid uuid, aid uuid, filename text, object_path text, mime_type text, bytes integer) returns void language sql security invoker set search_path='' as $$ select private.register_attachment(who,rid,nid,aid,filename,object_path,mime_type,bytes) $$;

-- Profile creation is deliberately unprivileged. Roles are never read from user_metadata.
create function private.new_auth_user() returns trigger language plpgsql security definer set search_path='' as $$ begin
 insert into public.profiles(id,name,email,active) values(new.id,coalesce(nullif(left(new.raw_user_meta_data->>'name',120),''),'New contact'),new.email,true) on conflict do nothing;return new;end $$;
create trigger net_tech_new_user after insert on auth.users for each row execute function private.new_auth_user();

-- Owner elevation is unavailable through the app. Trusted SQL bootstrap/recovery only.
create function private.protect_last_owner() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if old.role='owner' and old.active and (not new.active or new.role<>'owner') then
 perform pg_advisory_xact_lock(748120001);
 if (select count(*) from public.profiles where role='owner' and active and id<>old.id)=0 then raise exception 'At least one active owner is required.';end if;
 end if;return new;end $$;
create trigger protect_last_owner before update on public.profiles for each row execute function private.protect_last_owner();

-- Default PUBLIC function execution is unsafe for privileged helpers.
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on function public.command(text,uuid,uuid,jsonb) from public,anon;
grant execute on function public.command(text,uuid,uuid,jsonb) to authenticated;
grant execute on function private.command(text,uuid,uuid,jsonb),private.actor_role(),private.can_read(uuid),private.can_location(uuid),private.visible_profile(uuid) to authenticated;
revoke all on function public.register_attachment(uuid,uuid,uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.register_attachment(uuid,uuid,uuid,uuid,text,text,text,integer),private.register_attachment(uuid,uuid,uuid,uuid,text,text,text,integer) to service_role;
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;
commit;

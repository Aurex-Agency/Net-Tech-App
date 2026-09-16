begin;
revoke select on public.profiles from authenticated;
grant select(id,name,role,active) on public.profiles to authenticated;
create function private.my_profile() returns jsonb language sql stable security definer set search_path='' as $$ select to_jsonb(p)||jsonb_build_object('mfa_required',coalesce((select (data->>'require_staff_mfa')::boolean from public.settings where id),false)) from public.profiles p where p.id=auth.uid() $$;
create function public.my_profile() returns jsonb language sql security invoker set search_path='' as $$ select private.my_profile() $$;
create function private.visible_people() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'role',p.role,'active',p.active,'working_start',p.working_start,'working_end',p.working_end,'working_days',p.working_days,'email',case when p.id=auth.uid() or private.actor_role() in ('owner','dispatcher') then p.email else '' end,'phone',case when p.id=auth.uid() or private.actor_role() in ('owner','dispatcher') then p.phone else '' end,'email_notifications',case when p.id=auth.uid() then p.email_notifications else false end)),'[]') from public.profiles p where private.visible_profile(p.id)
$$;
create function public.visible_people() returns jsonb language sql security invoker set search_path='' as $$ select private.visible_people() $$;

create function private.create_invitation(token_hash text, target_email text, intended_role text, org_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
 declare result uuid;begin
 if private.actor_role() is distinct from 'owner' or auth.uid() is null then raise exception 'Owner access required.' using errcode='42501';end if;
 perform private.throttle(auth.uid()::text||':invitations',10,3600);
 if exists(select 1 from public.profiles where lower(email)=lower(target_email) and (role='owner' or not active)) then raise exception 'Use the verified recovery process for inactive accounts or owners.';end if;
 insert into private.invitations(token_hash,email,role,organization_id,expires_at,created_by) values(token_hash,lower(trim(target_email)),intended_role,org_id,now()+interval '7 days',auth.uid()) returning id into result;
 insert into private.audit_log(actor_id,action,record_id,after_data) values(auth.uid(),'invitation_prepared',result,jsonb_build_object('role',intended_role,'organization_id',org_id));return result;end $$;
create function public.create_invitation(token_hash text,target_email text,intended_role text,org_id uuid) returns uuid language sql security invoker set search_path='' as $$ select private.create_invitation(token_hash,target_email,intended_role,org_id) $$;
create function private.accept_invitation(hash text) returns void language plpgsql security definer set search_path='' as $$
 declare inv private.invitations;target public.profiles;current_email text;begin
 if auth.uid() is null then raise exception 'Sign in to accept the invitation.';end if;
 select * into inv from private.invitations where token_hash=hash for update;
 select lower(email) into current_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if inv.id is null or inv.accepted_at is not null or inv.expires_at<now() or inv.email is distinct from current_email then raise exception 'This invitation is expired, already used, or intended for a different account.';end if;
 select * into target from public.profiles where id=auth.uid() for update;
 if not target.active or target.role='owner' then raise exception 'Contact Net-Tech for account recovery.';end if;
 -- Existing staff cannot switch roles via an old client invitation.
 if target.role in ('technician','dispatcher') then raise exception 'Existing staff role changes require owner review.';end if;
 update public.profiles set role=inv.role where id=auth.uid();
 if inv.organization_id is not null then insert into public.memberships(user_id,organization_id,admin) values(auth.uid(),inv.organization_id,inv.role='client_admin') on conflict(user_id,organization_id) do update set active=true,admin=excluded.admin;end if;
 update private.invitations set accepted_at=now(),accepted_by=auth.uid() where id=inv.id;
 insert into private.audit_log(actor_id,action,record_id) values(auth.uid(),'invitation_accepted',inv.id);
 end $$;
create function public.accept_invitation(hash text) returns void language sql security invoker set search_path='' as $$ select private.accept_invitation(hash) $$;
create function private.revoke_pending_invites() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if not new.active and old.active then update private.invitations set expires_at=now() where email=lower(new.email) and accepted_at is null;end if;return new;end $$;
create trigger revoke_pending_invites after update on public.profiles for each row execute function private.revoke_pending_invites();

-- The worker claims rows with SKIP LOCKED and leases them. Provider retries reuse
-- the outbox UUID as the email idempotency key. Obsolete reminders are canceled.
create function private.claim_jobs(batch_size integer) returns jsonb language plpgsql security definer set search_path='' as $$
 declare output jsonb;begin
 update private.outbox set status='pending',lease_token=null where status='processing' and locked_at<now()-interval '10 minutes';
 update private.outbox set status='failed',last_error='Review delivery before retry: provider idempotency window elapsed' where status='pending' and attempts>0 and first_attempt_at<now()-interval '23 hours';
 with due as (select id from private.outbox where status='pending' and due_at<=now() order by due_at for update skip locked limit least(greatest(batch_size,1),50)), claimed as (update private.outbox o set status='processing',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),locked_at=now(),lease_token=gen_random_uuid() from due where o.id=due.id returning o.*)
 select coalesce(jsonb_agg(to_jsonb(claimed)),'[]') into output from claimed;return output;end $$;
create function public.claim_jobs(batch_size integer) returns jsonb language sql security invoker set search_path='' as $$ select private.claim_jobs(batch_size) $$;
create function private.delivery_context(job_id uuid,lease uuid) returns jsonb language plpgsql security definer set search_path='' as $$
 declare job private.outbox;p public.profiles;a public.appointments;begin
 select * into job from private.outbox where id=job_id and lease_token=lease and status='processing' for update;if not found then return null;end if;
 select * into p from public.profiles where id=job.recipient_id;
 if not p.active or not p.email_notifications or not private.can_read_as(job.request_id,p.id) then update private.outbox set status='canceled',lease_token=null where id=job_id;return null;end if;
 if job.appointment_id is not null then
 select * into a from public.appointments where id=job.appointment_id;
 if a.version<>job.appointment_version or a.status<>'confirmed' or a.starts_at<=now() then update private.outbox set status='canceled',lease_token=null where id=job_id;return null;end if;
 end if;
 return jsonb_build_object('email',p.email,'request_id',job.request_id,'kind',job.kind);end $$;
create function public.delivery_context(job_id uuid,lease uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.delivery_context(job_id,lease) $$;
create function private.finish_job(job_id uuid,lease uuid,ok boolean,error_code text) returns void language plpgsql security definer set search_path='' as $$
 declare job private.outbox;begin
 select * into job from private.outbox where id=job_id and lease_token=lease and status='processing' for update;if not found then return;end if;
 insert into private.delivery_attempts(outbox_id,ok,error_code) values(job_id,ok,left(error_code,200));
 update private.outbox set status=case when ok then 'sent' when attempts>=8 then 'failed' else 'pending' end,due_at=now()+make_interval(secs=>least(3600,(power(2,attempts)*30)::int)),last_error=case when ok then null else left(error_code,200) end,lease_token=null where id=job_id;
 end $$;
create function public.finish_job(job_id uuid,lease uuid,ok boolean,error_code text) returns void language sql security invoker set search_path='' as $$ select private.finish_job(job_id,lease,ok,error_code) $$;
create function private.close_resolved() returns integer language plpgsql security definer set search_path='' as $$
 declare cfg jsonb;r record;n integer:=0;begin select data into cfg from public.settings where id;
 if not (cfg->>'auto_close')::boolean then return 0;end if;
 for r in select id from public.requests where status='resolved' and resolved_at<now()-make_interval(days=>(cfg->>'closure_days')::int) for update skip locked loop
 update public.requests set status='closed',closed_at=now(),updated_at=now() where id=r.id;
 perform private.event(r.id,'Closed after the configured resolution window',null);n:=n+1;end loop;return n;end $$;
create function public.close_resolved() returns integer language sql security invoker set search_path='' as $$ select private.close_resolved() $$;

create function private.public_inquiry(inquiry_id uuid,rate_key text,details jsonb) returns uuid language plpgsql security definer set search_path='' as $$ begin
 perform private.throttle('public:'||rate_key,5,3600);
 if exists(select 1 from private.public_inquiries where id=inquiry_id) then return inquiry_id;end if;
 insert into private.public_inquiries(id,name,email,phone,organization,address,description,preferences) values(inquiry_id,details->>'name',details->>'email',coalesce(details->>'phone',''),details->>'organization',details->>'address',details->>'description',array(select jsonb_array_elements_text(coalesce(details->'preferences','[]'))));return inquiry_id;end $$;
create function public.public_inquiry(inquiry_id uuid,rate_key text,details jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.public_inquiry(inquiry_id,rate_key,details) $$;
create function private.list_inquiries() returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if coalesce(private.actor_role(),'') not in ('owner','dispatcher') or auth.uid() is null then raise exception 'Dispatch access required.';end if;
 return (select coalesce(jsonb_agg(to_jsonb(i)),'[]') from (select * from private.public_inquiries where converted_request_id is null order by created_at desc limit 100) i);end $$;
create function public.list_inquiries() returns jsonb language sql security invoker set search_path='' as $$ select private.list_inquiries() $$;
create function private.convert_inquiry(inquiry_id uuid,location_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
 declare i private.public_inquiries;org uuid;rid uuid;begin
 if coalesce(private.actor_role(),'') not in ('owner','dispatcher') or auth.uid() is null then raise exception 'Dispatch access required.';end if;
 select * into i from private.public_inquiries where id=inquiry_id for update;if i.id is null then raise exception 'Inquiry unavailable.';end if;if i.converted_request_id is not null then return i.converted_request_id;end if;
 select organization_id into org from public.locations where id=location_id;if org is null then raise exception 'Select a location.';end if;
 insert into public.requests(organization_id,location_id,created_by,kind,title,description,contact_name,contact_phone,preferences,intake_channel) values(org,location_id,auth.uid(),'estimate',left('Estimate: '||i.organization,160),i.description,i.name,i.phone,i.preferences,'public_estimate') returning id into rid;
 update private.public_inquiries set converted_request_id=rid where id=inquiry_id;perform private.event(rid,'Estimate inquiry accepted for scheduling',auth.uid());return rid;end $$;
create function public.convert_inquiry(inquiry_id uuid,location_id uuid) returns uuid language sql security invoker set search_path='' as $$ select private.convert_inquiry(inquiry_id,location_id) $$;

-- Bucket is private; upload registration is server-only after signature validation.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('request-files','request-files',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do nothing;
create policy net_tech_files_read on storage.objects for select to authenticated using(bucket_id='request-files' and exists(select 1 from public.attachments a where a.object_key=storage.objects.name and private.can_read(a.request_id) and (a.note_id is null or private.actor_role() in ('owner','dispatcher','technician'))));

revoke all on all functions in schema private from public,anon;
revoke all on function public.my_profile(),public.visible_people(),public.create_invitation(text,text,text,uuid),public.accept_invitation(text),public.list_inquiries(),public.convert_inquiry(uuid,uuid) from public,anon;
grant execute on function public.my_profile(),public.visible_people(),public.create_invitation(text,text,text,uuid),public.accept_invitation(text),public.list_inquiries(),public.convert_inquiry(uuid,uuid),private.my_profile(),private.visible_people(),private.create_invitation(text,text,text,uuid),private.accept_invitation(text),private.list_inquiries(),private.convert_inquiry(uuid,uuid) to authenticated;
revoke all on function public.claim_jobs(integer),public.delivery_context(uuid,uuid),public.finish_job(uuid,uuid,boolean,text),public.close_resolved(),public.public_inquiry(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.claim_jobs(integer),public.delivery_context(uuid,uuid),public.finish_job(uuid,uuid,boolean,text),public.close_resolved(),public.public_inquiry(uuid,text,jsonb),private.claim_jobs(integer),private.delivery_context(uuid,uuid),private.finish_job(uuid,uuid,boolean,text),private.close_resolved(),private.public_inquiry(uuid,text,jsonb) to service_role;
commit;

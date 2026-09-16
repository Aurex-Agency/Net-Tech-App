begin;
create table private.upload_sessions (
 id uuid primary key,request_id uuid not null references public.requests,note_id uuid,uploaded_by uuid not null references public.profiles,
 name text not null,mime text not null,size integer not null check(size between 1 and 10485760),created_at timestamptz not null default now(),completed_at timestamptz,cleaned_at timestamptz,
 foreign key(note_id,request_id) references public.notes(id,request_id)
);
alter table private.upload_sessions enable row level security;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('upload-quarantine','upload-quarantine',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do nothing;
-- No authenticated read policy on quarantine. Signed upload tokens allow only the
-- single reserved object path, never read/list/delete or arbitrary final objects.
create function private.begin_upload(who uuid,rid uuid,nid uuid,aid uuid,filename text,mime_type text,bytes integer) returns jsonb language plpgsql security definer set search_path='' as $$
 declare upload private.upload_sessions;begin
 if not private.can_read_as(rid,who) or (nid is not null and not exists(select 1 from public.profiles where id=who and active and role in ('technician','dispatcher','owner'))) then raise exception 'Upload access denied.';end if;
 perform 1 from public.requests where id=rid for update;
 select * into upload from private.upload_sessions where id=aid;
 if found then if upload.uploaded_by<>who or upload.request_id<>rid or upload.note_id is distinct from nid then raise exception 'Upload unavailable.';end if;return jsonb_build_object('id',aid,'complete',upload.completed_at is not null);end if;
 perform private.throttle(who::text||':upload',20,60);
 if mime_type not in ('image/jpeg','image/png','image/webp','application/pdf') then raise exception 'Unsupported file type.';end if;
 if (select count(*) from private.upload_sessions where request_id=rid and uploaded_by=who)>49 then raise exception 'Attachment limit reached. Contact Net-Tech.';end if;
 insert into private.upload_sessions(id,request_id,note_id,uploaded_by,name,mime,size) values(aid,rid,nid,who,left(filename,160),mime_type,bytes);
 return jsonb_build_object('id',aid,'complete',false);end $$;
create function public.begin_upload(who uuid,rid uuid,nid uuid,aid uuid,filename text,mime_type text,bytes integer) returns jsonb language sql security invoker set search_path='' as $$ select private.begin_upload(who,rid,nid,aid,filename,mime_type,bytes) $$;
create function private.get_upload(who uuid,aid uuid) returns jsonb language sql security definer set search_path='' as $$ select to_jsonb(u) from private.upload_sessions u where u.id=aid and u.uploaded_by=who and private.can_read_as(u.request_id,who) and (u.note_id is null or exists(select 1 from public.profiles p where p.id=who and p.active and p.role in ('technician','dispatcher','owner'))) $$;
create function public.get_upload(who uuid,aid uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.get_upload(who,aid) $$;
create function private.complete_upload(who uuid,aid uuid,mime_type text,bytes integer) returns void language plpgsql security definer set search_path='' as $$
 declare u private.upload_sessions;begin
 select * into u from private.upload_sessions where id=aid and uploaded_by=who for update;
 if not found or not private.can_read_as(u.request_id,who) then raise exception 'Upload access removed.';end if;
 if u.completed_at is not null then return;end if;
 perform private.register_attachment(who,u.request_id,u.note_id,aid,u.name,u.request_id||'/'||case when u.note_id is null then 'public' else 'internal' end||'/'||aid,mime_type,bytes);
 update private.upload_sessions set completed_at=now() where id=aid;end $$;
create function public.complete_upload(who uuid,aid uuid,mime_type text,bytes integer) returns void language sql security invoker set search_path='' as $$ select private.complete_upload(who,aid,mime_type,bytes) $$;
create function public.stale_uploads() returns jsonb language sql security definer set search_path='' as $$ select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select id,request_id,note_id,completed_at from private.upload_sessions where cleaned_at is null and created_at<now()-interval '1 day' order by created_at limit 100) x $$;
-- Keep SECURITY DEFINER in the private schema, including service-only cleanup.
alter function public.stale_uploads() set schema private;
create function public.stale_uploads() returns jsonb language sql security invoker set search_path='' as $$ select private.stale_uploads() $$;
create function private.ack_upload_cleanup(ids uuid[]) returns void language sql security definer set search_path='' as $$ update private.upload_sessions set cleaned_at=now() where id=any(ids) and created_at<now()-interval '1 day' $$;
create function public.ack_upload_cleanup(ids uuid[]) returns void language sql security invoker set search_path='' as $$ select private.ack_upload_cleanup(ids) $$;
revoke all on function public.ack_upload_cleanup(uuid[]) from public,anon,authenticated;
grant execute on function public.ack_upload_cleanup(uuid[]),private.ack_upload_cleanup(uuid[]) to service_role;
revoke all on all functions in schema private from public,anon;
revoke all on function public.begin_upload(uuid,uuid,uuid,uuid,text,text,integer),public.get_upload(uuid,uuid),public.complete_upload(uuid,uuid,text,integer),public.stale_uploads() from public,anon,authenticated;
grant execute on function public.begin_upload(uuid,uuid,uuid,uuid,text,text,integer),public.get_upload(uuid,uuid),public.complete_upload(uuid,uuid,text,integer),public.stale_uploads(),private.begin_upload(uuid,uuid,uuid,uuid,text,text,integer),private.get_upload(uuid,uuid),private.complete_upload(uuid,uuid,text,integer),private.stale_uploads() to service_role;
commit;

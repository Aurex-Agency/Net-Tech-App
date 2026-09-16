begin;
-- SECURITY INVOKER preserves every table policy in aggregate/read endpoints.
create function public.recent_messages(request_ids uuid[],per_request integer default 1)
returns setof public.messages language sql stable security invoker set search_path='' as $$
 select m.* from public.requests r cross join lateral
 (select * from public.messages where request_id=r.id order by created_at desc,id desc limit least(greatest(per_request,1),30)) m
 where r.id=any(request_ids) order by m.created_at,m.id
$$;
create function public.unread_counts() returns table(request_id uuid,unread bigint) language sql stable security invoker set search_path='' as $$
 select m.request_id,count(*) from public.messages m left join public.read_cursors c on c.request_id=m.request_id and c.user_id=auth.uid()
 where m.author_id<>auth.uid() and m.created_at>coalesce(c.read_at,'-infinity'::timestamptz) group by m.request_id
$$;
revoke all on function public.recent_messages(uuid[],integer),public.unread_counts() from public,anon;
grant execute on function public.recent_messages(uuid[],integer),public.unread_counts() to authenticated;
commit;

begin;
create function public.service_report() returns jsonb language plpgsql stable security invoker set search_path='' as $$
 declare result jsonb;begin
 if coalesce(private.actor_role(),'') not in ('owner','dispatcher') then raise exception 'Dispatch access required.';end if;
 select jsonb_build_object(
 'requests',(select count(*) from public.requests),
 'first_response_hours',(select avg(extract(epoch from (reply.first_at-r.created_at))/3600) from public.requests r cross join lateral(select min(m.created_at) first_at from public.messages m join public.profiles p on p.id=m.author_id where m.request_id=r.id and p.role in ('owner','dispatcher','technician')) reply where reply.first_at is not null),
 'resolution_hours',(select avg(extract(epoch from (resolved_at-created_at))/3600) from public.requests where status in ('resolved','closed') and resolved_at is not null),
 'reopened',(select count(*) from public.requests where reopen_count>0),
 'categories',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from (select category,count(*) count from public.requests group by category order by count(*) desc) c),
 'backlog',(select jsonb_build_array(count(*) filter(where created_at>now()-interval '1 day'),count(*) filter(where created_at<=now()-interval '1 day' and created_at>now()-interval '3 days'),count(*) filter(where created_at<=now()-interval '3 days' and created_at>now()-interval '7 days'),count(*) filter(where created_at<=now()-interval '7 days')) from public.requests where status not in ('resolved','closed','canceled')),
 'visits',(select count(*) from public.appointments where status='completed'),
 'minutes',(select coalesce(sum(minutes),0) from public.work_entries)
 ) into result;return result;end $$;
revoke all on function public.service_report() from public,anon;
grant execute on function public.service_report() to authenticated;
commit;

-- Site context is a separate staff-only projection, never part of client locations.
create function private.site_context() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(n)),'[]') from private.site_notes n where private.actor_role() in ('owner','dispatcher','technician') and private.can_location(n.location_id)
$$;
create function public.site_context() returns jsonb language sql security invoker set search_path='' as $$ select private.site_context() $$;
revoke all on function private.site_context(),public.site_context() from public,anon;
grant execute on function private.site_context(),public.site_context() to authenticated;

-- Dashboard totals cover all authorized history, independently of bounded cards.
create function public.workspace_counts() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'open',count(*) filter(where r.status not in ('resolved','closed','canceled')),
 'unassigned',count(*) filter(where r.status not in ('resolved','closed','canceled') and (r.assignee_id is null or p.active=false)),
 'high',count(*) filter(where r.status not in ('resolved','closed','canceled') and r.priority in ('high','urgent')),
 'waiting',count(*) filter(where r.status='waiting_client'),
 'resolved',count(*) filter(where r.status in ('resolved','closed')),
 'visits',(select count(*) from public.appointments where ends_at>=now() and status not in ('completed','canceled','no_show')))
 from public.requests r left join public.profiles p on p.id=r.assignee_id
$$;
revoke all on function public.workspace_counts() from public,anon;
grant execute on function public.workspace_counts() to authenticated;

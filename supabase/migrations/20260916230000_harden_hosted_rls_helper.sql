-- Supabase may provision this administrative event-trigger helper in public.
-- Browser roles never need to execute it. Preserve automatic RLS on new tables.
-- Local/test databases may not have the hosted helper at all.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

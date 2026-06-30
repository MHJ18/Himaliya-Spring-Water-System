begin;

-- Repository audit: the retained React app reads and writes customers, sales,
-- admin_profiles, bottle_prices, and app_settings. No retained code references
-- himalaya_snapshots. The live audit on 2026-06-27 confirmed this table has
-- zero rows. Abort instead of dropping if data appears before deployment.
do $$
declare
  snapshot_count bigint;
begin
  if to_regclass('public.himalaya_snapshots') is null then
    return;
  end if;

  execute 'select count(*) from public.himalaya_snapshots' into snapshot_count;
  if snapshot_count > 0 then
    raise exception 'Refusing to drop public.himalaya_snapshots: found % row(s)', snapshot_count;
  end if;
end
$$;

drop table if exists public.himalaya_snapshots;

commit;

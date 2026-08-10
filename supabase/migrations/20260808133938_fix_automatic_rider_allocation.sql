begin;

-- Automatic allocation used to stop silently whenever every active rider had
-- marked themselves unavailable in the rider app. Keep online riders first,
-- but fall back to an active account so the admin setting always has a visible
-- effect. The legacy autoAssignNearestRider flag now drives the only strategy
-- the stored data can support reliably: balanced rotation by last assignment.
create or replace function public.prepare_rider_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rider_row public.admin_profiles;
  configured_rider_id uuid;
  assignment_mode text;
  balance_assignments boolean := false;
  assignment_changed boolean;
begin
  if new.status = 'accepted' and new.assigned_rider_id is null then
    select
      coalesce(payload ->> 'riderAssignmentMode', 'manual'),
      nullif(payload ->> 'defaultRiderId', '')::uuid,
      case lower(coalesce(payload ->> 'autoAssignNearestRider', 'false'))
        when 'true' then true
        else false
      end
    into assignment_mode, configured_rider_id, balance_assignments
    from public.app_settings
    where owner_id = new.owner_id and id = 'main'
    limit 1;

    if assignment_mode = 'auto' then
      select * into rider_row
      from public.admin_profiles
      where owner_id = new.owner_id
        and role = 'Rider'
        and active = true
      order by
        case
          when rider_available = true
            and not balance_assignments
            and id = configured_rider_id then 0
          when rider_available = true then 1
          when not balance_assignments and id = configured_rider_id then 2
          else 3
        end,
        last_assigned_at asc nulls first,
        created_at asc
      for update skip locked
      limit 1;

      new.assigned_rider_id := rider_row.id;
    end if;
  end if;

  if tg_op = 'INSERT' then
    assignment_changed := new.assigned_rider_id is not null;
  else
    assignment_changed := new.assigned_rider_id is distinct from old.assigned_rider_id;
  end if;

  if assignment_changed then
    if new.assigned_rider_id is null then
      new.assigned_at := null;
      new.rider_name := '';
      new.rider_phone := '';
      if new.tracking_status <> 'delivered' then
        new.tracking_status := 'unassigned';
      end if;
    else
      if rider_row.id is null or rider_row.id <> new.assigned_rider_id then
        select * into rider_row
        from public.admin_profiles
        where id = new.assigned_rider_id
          and owner_id = new.owner_id
          and role = 'Rider'
          and active = true
        limit 1;
      end if;

      if rider_row.id is null then
        raise exception 'Select an active rider from this business';
      end if;

      new.assigned_at := now();
      new.rider_name := rider_row.name;
      new.rider_phone := rider_row.phone;
      if new.status = 'pending' then
        new.status := 'accepted';
        new.accepted_at := coalesce(new.accepted_at, now());
      end if;
      if new.tracking_status = 'unassigned' then
        new.tracking_status := 'assigned';
      end if;

      update public.admin_profiles
      set last_assigned_at = now()
      where id = rider_row.id;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.prepare_rider_assignment() from public, anon, authenticated;

-- Switching the setting to automatic should also pick up accepted orders that
-- were already waiting for dispatch. Mentioning status fires the assignment
-- trigger; mentioning assigned_rider_id also lets the existing conversation
-- and push hooks observe the value written by that BEFORE trigger.
create or replace function public.refresh_automatic_rider_assignments()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id = 'main'
     and coalesce(new.payload ->> 'riderAssignmentMode', 'manual') = 'auto' then
    update public.customer_orders
    set status = status,
        assigned_rider_id = assigned_rider_id,
        updated_at = now()
    where owner_id = new.owner_id
      and status = 'accepted'
      and assigned_rider_id is null;
  end if;

  return new;
end;
$$;

revoke all on function public.refresh_automatic_rider_assignments() from public, anon, authenticated;

drop trigger if exists app_settings_refresh_automatic_rider_assignments
  on public.app_settings;
create trigger app_settings_refresh_automatic_rider_assignments
after insert or update of payload on public.app_settings
for each row execute function public.refresh_automatic_rider_assignments();

comment on function public.refresh_automatic_rider_assignments() is
  'Assigns accepted backlog orders immediately when automatic rider allocation is saved.';

-- Repair the upgrade path as well as future settings changes. Owners who
-- already enabled automatic allocation may have accepted orders waiting from
-- before this function was installed.
update public.customer_orders as orders
set status = orders.status,
    assigned_rider_id = orders.assigned_rider_id,
    updated_at = now()
where orders.status = 'accepted'
  and orders.assigned_rider_id is null
  and exists (
    select 1
    from public.app_settings as settings
    where settings.owner_id = orders.owner_id
      and settings.id = 'main'
      and coalesce(settings.payload ->> 'riderAssignmentMode', 'manual') = 'auto'
  );

commit;

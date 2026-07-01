create table if not exists public.inventory_stock (
  owner_id uuid not null default private.current_owner_id() references auth.users(id) on delete cascade,
  bottle_type text not null,
  quantity integer not null default 0 check (quantity >= 0),
  last_low_stock_alert_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (owner_id, bottle_type)
);

alter table public.inventory_stock enable row level security;
drop policy if exists "Owner inventory access" on public.inventory_stock;
create policy "Owner inventory access" on public.inventory_stock for all to authenticated
using (owner_id = (select private.current_owner_id()))
with check (owner_id = (select private.current_owner_id()));
revoke all on table public.inventory_stock from public, anon;
grant select, insert, update, delete on table public.inventory_stock to authenticated;

create or replace function public.consume_inventory_for_sale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining integer;
  threshold_value integer;
  last_alert timestamptz;
begin
  update public.inventory_stock
  set quantity = greatest(0, quantity - new.quantity), updated_at = now()
  where owner_id = new.owner_id and bottle_type = new.bottle_type
  returning quantity, last_low_stock_alert_at into remaining, last_alert;

  if remaining is null then return new; end if;
  select coalesce(nullif(setting.payload ->> 'lowStockThreshold', '')::integer, 20)
  into threshold_value
  from public.app_settings setting
  where setting.owner_id = new.owner_id and setting.id = 'main';
  threshold_value := coalesce(threshold_value, 20);

  if remaining <= threshold_value and (last_alert is null or last_alert < now() - interval '12 hours') then
    insert into public.customer_notifications (owner_id, audience, type, title, detail)
    values (new.owner_id, 'admin', 'stock', 'Low stock alert', concat(new.bottle_type, ' stock is down to ', remaining, ' units.'));
    update public.inventory_stock set last_low_stock_alert_at = now()
    where owner_id = new.owner_id and bottle_type = new.bottle_type;
  end if;
  return new;
end
$$;

revoke all on function public.consume_inventory_for_sale() from public, anon, authenticated;
drop trigger if exists consume_inventory_after_sale on public.sales;
create trigger consume_inventory_after_sale after insert on public.sales
for each row execute function public.consume_inventory_for_sale();

notify pgrst, 'reload schema';

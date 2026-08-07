begin;

-- This RPC was added to the original ledger migration after that migration had
-- already reached production. Keep a forward-only migration so existing linked
-- projects and fresh installs both receive the customer-scoped history endpoint.
create or replace function public.get_customer_manual_sales_history()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_uid uuid := (select auth.uid());
  linked_owner_id uuid;
  linked_customer_id text;
  result jsonb;
begin
  if caller_uid is null then
    raise exception 'An authenticated customer session is required'
      using errcode = '42501';
  end if;

  select customer.owner_id, customer.id
  into linked_owner_id, linked_customer_id
  from public.customers customer
  where customer.auth_user_id = caller_uid
    and customer.active = true
  limit 1;

  if linked_customer_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', sale.id,
        'bottle_type', sale.bottle_type,
        'quantity', sale.quantity,
        'price_per_bottle', sale.price_per_bottle,
        'total_amount', sale.total_amount,
        'amount_paid', least(
          greatest(0, coalesce(sale.total_amount, 0)),
          greatest(0, coalesce(sale.amount_paid, 0))
            + greatest(0, coalesce(active_allocation.amount, 0))
        ),
        'balance_due', greatest(
          0,
          greatest(0, coalesce(sale.total_amount, 0))
            - greatest(0, coalesce(sale.amount_paid, 0))
            - greatest(0, coalesce(active_allocation.amount, 0))
        ),
        'payment_schedule', coalesce(sale.payment_schedule, 'monthly'),
        'created_at', sale.created_at
      )
      order by sale.created_at desc, sale.id::text desc
    ),
    '[]'::jsonb
  ) into result
  from public.sales sale
  left join lateral (
    select coalesce(sum(allocation.amount), 0) as amount
    from public.customer_payment_allocations allocation
    join public.customer_payments payment
      on payment.id = allocation.payment_id
     and payment.owner_id = allocation.owner_id
     and payment.customer_id = allocation.customer_id
     and payment.status = 'applied'
    where allocation.owner_id = sale.owner_id
      and allocation.customer_id = sale.customer_id
      and allocation.source_key = sale.id::text
      and allocation.source_type = 'sale'
  ) active_allocation on true
  where sale.owner_id = linked_owner_id
    and sale.customer_id = linked_customer_id;

  return result;
end
$$;

revoke all on function public.get_customer_manual_sales_history()
  from public, anon;
grant execute on function public.get_customer_manual_sales_history()
  to authenticated;

notify pgrst, 'reload schema';

commit;

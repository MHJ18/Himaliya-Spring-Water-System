begin;

-- Invoice numbers appear on printed documents and older numbers are shorter
-- than today's capability-style values. Keep those verification URLs working,
-- but never expose customer/staff contact details or transaction history to an
-- anonymous caller. Authenticated staff and customers retain their existing
-- RLS-protected table access to the complete invoice.
create or replace function public.lookup_invoice_by_number(p_invoice_number text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'company', jsonb_build_object(
      'name', coalesce(invoice.payload #> '{company,name}', '"Himaliya Spring Water"'::jsonb),
      'phone', coalesce(invoice.payload #> '{company,phone}', 'null'::jsonb),
      'email', coalesce(invoice.payload #> '{company,email}', 'null'::jsonb),
      'address', coalesce(invoice.payload #> '{company,address}', '"Sialkot Cantt"'::jsonb),
      'serviceArea', coalesce(invoice.payload #> '{company,serviceArea}', 'null'::jsonb),
      'footer', coalesce(invoice.payload #> '{company,footer}', 'null'::jsonb)
    ),
    'customer', jsonb_build_object('name', 'Customer'),
    'preparedBy', jsonb_build_object(
      'name', 'Himaliya Spring Water',
      'role', 'Billing'
    ),
    'history', '[]'::jsonb,
    'summary', jsonb_build_object(
      'entryCount', coalesce(invoice.payload #> '{summary,entryCount}', '0'::jsonb),
      'grossAmount', coalesce(invoice.payload #> '{summary,grossAmount}', to_jsonb(invoice.total_amount)),
      'amountPaid', coalesce(invoice.payload #> '{summary,amountPaid}', '0'::jsonb),
      'totalAmount', to_jsonb(invoice.total_amount),
      'totalQty', to_jsonb(invoice.total_qty),
      'issuedAt', coalesce(invoice.payload #> '{summary,issuedAt}', to_jsonb(invoice.invoice_date)),
      'dueDate', coalesce(invoice.payload #> '{summary,dueDate}', 'null'::jsonb),
      'paymentTermsDays', coalesce(invoice.payload #> '{summary,paymentTermsDays}', 'null'::jsonb)
    ),
    'invoice_number', invoice.invoice_number,
    'invoice_date', invoice.invoice_date,
    'total_amount', invoice.total_amount,
    'total_qty', invoice.total_qty,
    'payment_status', invoice.payment_status,
    'validated', invoice.validated,
    'public_redacted', true
  )
  from public.customer_invoices invoice
  where length(btrim(coalesce(p_invoice_number, ''))) between 8 and 80
    and btrim(p_invoice_number) ~* '^HSW-[A-Z0-9-]+$'
    and upper(invoice.invoice_number) = upper(btrim(p_invoice_number))
  limit 1
$$;

revoke all on function public.lookup_invoice_by_number(text)
  from public, anon, authenticated;
grant execute on function public.lookup_invoice_by_number(text)
  to anon, authenticated;

notify pgrst, 'reload schema';

commit;

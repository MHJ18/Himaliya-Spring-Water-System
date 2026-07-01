import { dbRequest } from '../cloud/supabaseClient';

export async function getInventory() {
  const rows = await dbRequest('/inventory_stock?select=bottle_type,quantity&order=bottle_type.asc');
  return rows.reduce((result, row) => ({ ...result, [row.bottle_type]: Number(row.quantity) || 0 }), {});
}

export async function saveInventory(stock) {
  const rows = Object.entries(stock).map(([bottleType, quantity]) => ({ bottle_type: bottleType, quantity: Math.max(0, Number(quantity) || 0), updated_at: new Date().toISOString() }));
  await dbRequest('/inventory_stock?on_conflict=owner_id,bottle_type', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: JSON.stringify(rows),
  });
  return true;
}

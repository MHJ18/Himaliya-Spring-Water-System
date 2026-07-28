import { dbRequest } from '../cloud/supabaseClient';

export async function getDatabaseStats() {
  const stats = await dbRequest('/rpc/get_owner_database_stats', {
    method: 'POST',
    body: '{}',
  });
  return stats || {};
}

export async function resetBusinessData() {
  return dbRequest('/rpc/reset_owner_business_data', {
    method: 'POST',
    body: JSON.stringify({ p_confirmation: 'RESET DATABASE' }),
  });
}

export function getSupabaseUsageUrl() {
  return 'https://supabase.com/dashboard/org/_/usage';
}

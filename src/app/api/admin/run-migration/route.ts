import { apiResponse } from '@/lib/api-response';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * One-time migration endpoint.
 * Call this ONCE via: POST /api/admin/run-migration
 * It adds the `must_change_password` column to the profiles table.
 */
export async function POST() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Use RPC to run raw SQL — requires the exec_sql function or pg_net
    // Instead, we'll do it via a direct REST call to the Postgres endpoint
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return apiResponse.error('Missing environment variables.');
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_migration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      },
      body: JSON.stringify({
        sql: 'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;'
      }),
    });

    if (!response.ok) {
      // Fallback: try direct SQL via supabase-js
      // Note: supabase-js doesn't support raw DDL. We'll mark as manual.
      return apiResponse.error(
        'Could not run migration automatically. Please run this SQL in your Supabase SQL Editor:\n\n' +
        'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;'
      );
    }

    return apiResponse.success({}, 'Migration applied successfully.');
  } catch (error: any) {
    return apiResponse.internalError(error);
  }
}

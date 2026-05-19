import { apiResponse } from '@/lib/api-response';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, deletedBy, fullName } = body;

    if (!id) {
      return apiResponse.error('Member ID is required.');
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Delete profile explicitly first to handle relations if any
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', id);

    if (profileError) {
      return apiResponse.error(`Profile Delete Error: ${profileError.message}`);
    }

    // 2. Delete user from Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) {
      // It's possible the auth user was already deleted, so we log it but don't crash
      console.warn(`Auth delete warning: ${authError.message}`);
    }

    // 3. Log Activity
    if (deletedBy) {
      await supabaseAdmin.from('activity_log').insert({
        user_id: deletedBy,
        action: 'deleted team member',
        entity_type: 'profile',
        entity_id: id,
        entity_name: fullName || 'Team Member'
      });
    }

    return apiResponse.success({ id }, 'Team member successfully deleted.', 200);

  } catch (error: any) {
    return apiResponse.internalError(error);
  }
}

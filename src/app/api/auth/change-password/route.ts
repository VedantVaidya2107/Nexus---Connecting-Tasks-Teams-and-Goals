import { apiResponse } from '@/lib/api-response';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, newPassword } = body;

    if (!userId || !newPassword) {
      return apiResponse.error('userId and newPassword are required.');
    }

    if (newPassword.length < 6) {
      return apiResponse.error('Password must be at least 6 characters.');
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Update the password in Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (authError) {
      return apiResponse.error(`Failed to update password: ${authError.message}`);
    }

    // 2. Clear the must_change_password flag on the profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', userId);

    if (profileError) {
      console.error('Failed to clear must_change_password flag:', profileError);
      // Don't fail the whole request — password was already changed
    }

    // 3. Log Activity
    await supabaseAdmin.from('activity_log').insert({
      user_id: userId,
      action: 'changed temporary password',
      entity_type: 'profile',
      entity_id: userId,
      entity_name: 'Self',
    });

    return apiResponse.success({ userId }, 'Password changed successfully.', 200);

  } catch (error: any) {
    return apiResponse.internalError(error);
  }
}

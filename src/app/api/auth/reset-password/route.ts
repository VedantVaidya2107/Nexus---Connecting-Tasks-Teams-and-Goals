import { apiResponse } from '@/lib/api-response';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return apiResponse.error('Email and new password are required.');
    }

    if (password.length < 6) {
      return apiResponse.error('Password must be at least 6 characters.');
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Fetch user ID from profiles table
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('email', email.trim())
      .maybeSingle();

    if (profileError || !userProfile) {
      return apiResponse.error('No account found with this email address.');
    }

    // 2. Reset user password in Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userProfile.id, {
      password: password
    });

    if (authError) {
      return apiResponse.error(`Failed to update password: ${authError.message}`);
    }

    // 3. Log Activity
    await supabaseAdmin.from('activity_log').insert({
      user_id: userProfile.id,
      action: 'reset own password',
      entity_type: 'profile',
      entity_id: userProfile.id,
      entity_name: userProfile.full_name
    });

    return apiResponse.success({ email }, 'Password successfully reset.', 200);

  } catch (error: any) {
    return apiResponse.internalError(error);
  }
}

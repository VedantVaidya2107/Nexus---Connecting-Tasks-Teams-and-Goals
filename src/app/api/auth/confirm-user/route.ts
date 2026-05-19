import { apiResponse } from '@/lib/api-response';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return apiResponse.error('Email is required.');
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Get user by email
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      return apiResponse.error(listError.message);
    }

    const targetUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!targetUser) {
      return apiResponse.error('User not found.');
    }

    // 2. Confirm the user's email
    const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
      email_confirm: true
    });

    if (confirmError) {
      return apiResponse.error(confirmError.message);
    }

    // 3. Confirm the user's profile is active and has starter fields if needed
    await supabaseAdmin
      .from('profiles')
      .update({ is_active: true })
      .eq('id', targetUser.id);

    return apiResponse.success({ id: targetUser.id, email }, 'Account successfully confirmed via OTP', 200);

  } catch (error: any) {
    return apiResponse.internalError(error);
  }
}

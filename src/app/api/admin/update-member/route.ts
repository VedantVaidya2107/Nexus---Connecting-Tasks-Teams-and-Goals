import { apiResponse } from '@/lib/api-response';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, fullName, email, role, department, jobTitle, password, updatedBy } = body;

    if (!id || !fullName || !email || !role) {
      return apiResponse.error('Missing required fields: id, fullName, email, and role are required.');
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Update Auth details (email and optionally password)
    const authUpdateData: any = { email };
    if (password && password.length >= 6) {
      authUpdateData.password = password;
    }

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdateData);
    if (authError) {
      return apiResponse.error(`Auth Update Error: ${authError.message}`);
    }

    // 2. Update profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: fullName,
        email,
        role,
        department,
        job_title: jobTitle
      })
      .eq('id', id);

    if (profileError) {
      return apiResponse.error(`Profile Update Error: ${profileError.message}`);
    }

    // 3. Log Activity
    if (updatedBy) {
      await supabaseAdmin.from('activity_log').insert({
        user_id: updatedBy,
        action: 'updated team member',
        entity_type: 'profile',
        entity_id: id,
        entity_name: fullName
      });
    }

    return apiResponse.success({ id, email, role }, 'Team member updated successfully', 200);

  } catch (error: any) {
    return apiResponse.internalError(error);
  }
}

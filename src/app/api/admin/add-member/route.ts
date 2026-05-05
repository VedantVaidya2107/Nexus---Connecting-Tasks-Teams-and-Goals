import { apiResponse } from '@/lib/api-response';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fullName, email, role, department, jobTitle, password, createdBy } = body;

    // 1. Basic Validation
    if (!fullName || !email || !role || !password) {
      return apiResponse.error('Missing required fields: fullName, email, role, and password are required.');
    }

    // 2. Auth Check (Verify the requester is an admin)
    // In a real app, we'd verify the JWT from the header
    // For now, we assume the frontend sends the createdBy ID of an admin

    // 3. Create user in Supabase Auth
    const supabaseAdmin = getSupabaseAdmin();
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (authError) {
      return apiResponse.error(authError.message);
    }

    const userId = authData.user.id;

    // 4. Update the profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: fullName,
        role,
        department,
        job_title: jobTitle,
        created_by: createdBy,
        start_date: new Date().toISOString().split('T')[0]
      })
      .eq('id', userId);

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return apiResponse.error(profileError.message);
    }

    // 5. Log Activity
    await supabaseAdmin.from('activity_log').insert({
      user_id: createdBy,
      action: 'added team member',
      entity_type: 'profile',
      entity_id: userId,
      entity_name: fullName
    });

    return apiResponse.success({ id: userId, email, role }, 'Team member added successfully', 201);

  } catch (error: any) {
    return apiResponse.internalError(error);
  }
}

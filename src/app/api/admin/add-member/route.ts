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

    // 2. Create user in Supabase Auth
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

    // 3. Update the profile — also set must_change_password = true
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: fullName,
        role,
        department,
        job_title: jobTitle,
        created_by: createdBy,
        start_date: new Date().toISOString().split('T')[0],
        must_change_password: true,
      })
      .eq('id', userId);

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return apiResponse.error(profileError.message);
    }

    // 4. Send welcome email with temporary password
    let emailSent = false;
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const emailRes = await fetch(`${baseUrl}/api/auth/send-welcome-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, fullName, temporaryPassword: password }),
      });
      const emailData = await emailRes.json();
      if (emailRes.ok && emailData.success && emailData.data?.sent) {
        emailSent = true;
      }
    } catch (emailError) {
      console.error('Welcome email dispatch failed (non-fatal):', emailError);
    }

    // 5. Log Activity
    await supabaseAdmin.from('activity_log').insert({
      user_id: createdBy,
      action: 'added team member',
      entity_type: 'profile',
      entity_id: userId,
      entity_name: fullName
    });

    return apiResponse.success({ id: userId, email, role, password, emailSent }, 'Team member added successfully', 201);

  } catch (error: any) {
    return apiResponse.internalError(error);
  }
}

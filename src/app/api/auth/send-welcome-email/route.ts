import { apiResponse } from '@/lib/api-response';
import { sendWelcomeEmail } from '@/lib/mail';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, fullName, temporaryPassword } = body;

    if (!email || !fullName || !temporaryPassword) {
      return apiResponse.error('Email, fullName, and temporaryPassword are required.');
    }

    const emailResult = await sendWelcomeEmail(email, fullName, temporaryPassword);

    if (emailResult.sent) {
      return apiResponse.success({ sent: true, email }, 'Welcome email dispatched successfully.', 200);
    } else {
      return apiResponse.success({ sent: false, email }, 'Welcome email simulated (Demo mode).', 200);
    }
  } catch (error: any) {
    return apiResponse.internalError(error);
  }
}

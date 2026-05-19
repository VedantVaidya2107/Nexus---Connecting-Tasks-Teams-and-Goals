import { apiResponse } from '@/lib/api-response';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, fullName, temporaryPassword } = body;

    if (!email || !fullName || !temporaryPassword) {
      return apiResponse.error('Email, fullName, and temporaryPassword are required.');
    }

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    let nodemailer: any;
    try {
      nodemailer = require('nodemailer');
    } catch (e) {
      console.log('Nodemailer not installed. Operating in simulated mode.');
    }

    if (nodemailer && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: smtpUser, pass: smtpPass },
      });

      const mailOptions = {
        from: `"Nexus Team" <${smtpUser}>`,
        to: email,
        subject: 'Welcome to Nexus – Your Account Details',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #0b0d19; color: #f8fafc;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #7c3aed; margin: 0; font-size: 28px;">Nexus</h1>
              <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 14px;">Connecting tasks, teams, and goals</p>
            </div>
            <div style="background: rgba(255,255,255,0.03); padding: 24px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
              <h2 style="font-size: 20px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; margin-top: 0; color: #fff;">Welcome aboard, ${fullName}! 🎉</h2>
              <p style="line-height: 1.6; color: #cbd5e1;">Your Nexus account has been created by your administrator. Here are your login credentials:</p>
              
              <div style="background: rgba(124, 58, 237, 0.1); border: 1px solid rgba(124, 58, 237, 0.3); border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; color: #94a3b8; font-size: 13px;">Email Address</p>
                <p style="margin: 0 0 16px 0; color: #fff; font-weight: 600; font-size: 16px;">${email}</p>
                <p style="margin: 0 0 8px 0; color: #94a3b8; font-size: 13px;">Temporary Password</p>
                <p style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 3px; color: #c084fc; background: #1e1b4b; display: inline-block; padding: 8px 16px; border-radius: 6px; border: 1px solid #4c1d95;">${temporaryPassword}</p>
              </div>

              <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 6px; padding: 12px 16px; margin-top: 16px;">
                <p style="margin: 0; color: #fbbf24; font-size: 13px;">⚠️ <strong>Important:</strong> You will be required to set a new password when you first log in. Please keep this temporary password safe.</p>
              </div>

              <p style="line-height: 1.6; color: #94a3b8; font-size: 13px; margin-top: 20px;">Log in at your organization's Nexus portal and you'll be prompted to create a secure permanent password.</p>
            </div>
            <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 30px 0 20px 0;" />
            <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0;">© 2026 Nexus. All rights reserved. If you did not expect this email, please contact your administrator.</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Welcome email sent to ${email} via SMTP.`);
      return apiResponse.success({ sent: true, email }, 'Welcome email dispatched successfully.', 200);
    }

    // Fallback: simulated mode
    console.log(`[SIMULATION MODE] Welcome email for ${email} with temp password: ${temporaryPassword}`);
    return apiResponse.success({ sent: false, email }, 'Welcome email simulated (Demo mode).', 200);

  } catch (error: any) {
    return apiResponse.internalError(error);
  }
}

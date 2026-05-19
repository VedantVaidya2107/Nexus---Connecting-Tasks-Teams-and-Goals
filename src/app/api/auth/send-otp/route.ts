import { apiResponse } from '@/lib/api-response';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return apiResponse.error('Email and OTP are required.');
    }

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    // Try dynamic require for nodemailer in case user installs it
    let nodemailer;
    try {
      nodemailer = require('nodemailer');
    } catch (e) {
      console.log('Nodemailer is not installed. Operating in simulated email dispatch mode.');
    }

    if (nodemailer && smtpUser && smtpPass) {
      // 1. Create Nodemailer transporter
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      // 2. Format HTML email body
      const mailOptions = {
        from: `"Nexus Security" <${smtpUser}>`,
        to: email,
        subject: 'Nexus Email Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #0b0d19; color: #f8fafc;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #7c3aed; margin: 0; font-size: 28px;">Nexus</h1>
              <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 14px;">Connecting tasks, teams, and goals</p>
            </div>
            <div style="background: rgba(255,255,255,0.03); padding: 24px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
              <h2 style="font-size: 20px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; margin-top: 0; color: #fff;">Confirm Your Email</h2>
              <p style="line-height: 1.6; color: #cbd5e1;">Hello,</p>
              <p style="line-height: 1.6; color: #cbd5e1;">Thank you for signing up for Nexus! Please use the following One-Time Password (OTP) to verify your email address and activate your account:</p>
              <div style="text-align: center; margin: 30px 0;">
                <span style="font-size: 32px; font-weight: 800; letter-spacing: 4px; padding: 12px 24px; background-color: #1e1b4b; border: 1px solid #4c1d95; border-radius: 8px; color: #c084fc; display: inline-block;">${otp}</span>
              </div>
              <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">This code is valid for 10 minutes. If you did not request this verification, please ignore this email.</p>
            </div>
            <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 30px 0 20px 0;" />
            <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0;">&copy; 2026 Nexus. All rights reserved.</p>
          </div>
        `,
      };

      // 3. Dispatch the real email
      await transporter.sendMail(mailOptions);
      console.log(`Real email sent to ${email} via SMTP.`);
      return apiResponse.success({ sent: true, email }, 'OTP email successfully dispatched.', 200);
    }

    // Fallback: simulated mode
    console.log(`[SIMULATION MODE] Generated OTP for ${email}: ${otp}`);
    return apiResponse.success({ sent: false, email, otp }, 'OTP successfully generated (Demo mode).', 200);

  } catch (error: any) {
    return apiResponse.internalError(error);
  }
}

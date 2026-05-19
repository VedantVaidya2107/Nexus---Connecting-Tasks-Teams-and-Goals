'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

type SignUpStep = 'DETAILS' | 'OTP' | 'PASSWORD';
type ForgotStep = 'EMAIL' | 'OTP' | 'RESET';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  
  // Auth state switches
  const [isSignUp, setIsSignUp] = useState(false);
  const [signUpStep, setSignUpStep] = useState<SignUpStep>('DETAILS');

  // Forgot Password state switches
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotStep>('EMAIL');

  // Input states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  // Status and error states
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP Verification States
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState<string[]>(Array(6).fill(''));
  const [otpError, setOtpError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first OTP input when step switches to OTP
  useEffect(() => {
    if (
      (((isSignUp && signUpStep === 'OTP') || (isForgotPassword && forgotStep === 'OTP'))) && 
      otpRefs.current[0]
    ) {
      otpRefs.current[0].focus();
    }
  }, [isSignUp, signUpStep, isForgotPassword, forgotStep]);

  const generateAndSendOtp = async (targetEmail: string) => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(otp);
    setEnteredOtp(Array(6).fill(''));
    setOtpError('');
    setEmailSent(false);
    
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, otp })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        if (result.data.sent) {
          setEmailSent(true);
          toast.success(`📩 Verification email sent to ${targetEmail}!`, {
            duration: 6000,
            icon: '✉️'
          });
        } else {
          setEmailSent(false);
          toast.success(`🧪 [DEMO MODE] Verification simulated! OTP: ${otp}`, {
            duration: 8000,
            icon: '⚡'
          });
        }
      } else {
        throw new Error(result.message || 'Error dispatching verification code.');
      }
    } catch (err: any) {
      console.error('OTP Send Error:', err);
      setEmailSent(false);
      toast.success(`🧪 [DEMO MODE] Verification simulated! OTP: ${otp}`, {
        duration: 8000,
        icon: '⚡'
      });
    }
  };

  // Step 1: Handle Details Submission (Before Password Creation)
  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const trimmedEmail = email.trim();

      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', trimmedEmail)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking duplicate user:', checkError);
      }

      if (existingUser) {
        setError('An account with this email address already exists. Please sign in instead.');
        setLoading(false);
        return;
      }

      await generateAndSendOtp(trimmedEmail);
      setSignUpStep('OTP');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Handle OTP code verification (Signup)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    setLoading(true);

    const enteredCode = enteredOtp.join('');
    if (enteredCode.length < 6) {
      setOtpError('Please enter all 6 digits.');
      setLoading(false);
      return;
    }

    if (enteredCode !== generatedOtp) {
      setOtpError('Invalid verification code. Please enter the correct code.');
      setLoading(false);
      return;
    }

    toast.success('✨ Email verified successfully!');
    setSignUpStep('PASSWORD');
    setLoading(false);
  };

  // Step 3: Create password & complete registration (Signup)
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      const trimmedEmail = email.trim();

      const { error: err } = await signUp(trimmedEmail, password, fullName);
      if (err) { 
        setError(err.message); 
        setLoading(false); 
        return; 
      }

      const response = await fetch('/api/auth/confirm-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to confirm email account.');
      }

      const { error: loginErr } = await signIn(trimmedEmail, password);
      if (loginErr) {
        toast.error('Registration complete! Please sign in.');
        setIsSignUp(false);
        setSignUpStep('DETAILS');
        return;
      }

      toast.success('🚀 Welcome to Nexus! Redirecting...');
      router.push('/dashboard');

    } catch (err: any) {
      setError(err.message || 'An error occurred while creating your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // --- FORGOT PASSWORD HANDLERS ---

  // Forgot Step 1: Submit Email
  const handleForgotEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const trimmedEmail = email.trim();

      // Check if user actually exists
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', trimmedEmail)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking user:', checkError);
      }

      if (!existingUser) {
        setError('No account matches this email address.');
        setLoading(false);
        return;
      }

      // Generate OTP and Send
      await generateAndSendOtp(trimmedEmail);
      setForgotStep('OTP');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot Step 2: Verify OTP
  const handleForgotOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    setLoading(true);

    const enteredCode = enteredOtp.join('');
    if (enteredCode.length < 6) {
      setOtpError('Please enter all 6 digits.');
      setLoading(false);
      return;
    }

    if (enteredCode !== generatedOtp) {
      setOtpError('Invalid verification code. Please enter the correct code.');
      setLoading(false);
      return;
    }

    toast.success('✨ Verification code accepted!');
    setForgotStep('RESET');
    setLoading(false);
  };

  // Forgot Step 3: Set New Password
  const handleForgotResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      const trimmedEmail = email.trim();

      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to update credentials.');
      }

      toast.success('🎉 Password updated successfully! Please log in.');
      
      // Clean up states and bring back to Login Form
      setIsForgotPassword(false);
      setIsSignUp(false);
      setPassword('');
      setConfirmPassword('');
      setError('');
    } catch (err: any) {
      setError(err.message || 'An error occurred while resetting your password.');
    } finally {
      setLoading(false);
    }
  };

  // Standard Login Submit
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: err } = await signIn(email.trim(), password);
      if (err) { 
        setError(err.message); 
        setLoading(false); 
        return; 
      }
      toast.success('Successfully logged in! Welcome back.');
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during login.');
      setLoading(false);
    }
  };

  // OTP Code Inputs Handlers
  const handleOtpChange = (value: string, index: number) => {
    if (value !== '' && !/^[0-9]$/.test(value)) return;

    const newOtp = [...enteredOtp];
    newOtp[index] = value;
    setEnteredOtp(newOtp);
    setOtpError('');

    if (value !== '' && index < 5 && otpRefs.current[index + 1]) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (enteredOtp[index] === '' && index > 0 && otpRefs.current[index - 1]) {
        const newOtp = [...enteredOtp];
        newOtp[index - 1] = '';
        setEnteredOtp(newOtp);
        otpRefs.current[index - 1]?.focus();
      } else {
        const newOtp = [...enteredOtp];
        newOtp[index] = '';
        setEnteredOtp(newOtp);
      }
      setOtpError('');
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (!/^\d{6}$/.test(pastedData)) {
      toast.error('Please paste a valid 6-digit numeric OTP code.');
      return;
    }

    const digits = pastedData.split('');
    setEnteredOtp(digits);
    setOtpError('');
    otpRefs.current[5]?.focus();
  };

  return (
    <div className="auth-page">
      <Toaster position="top-right" reverseOrder={false} />
      <div className="auth-orb-3" />
      <div className="auth-card glass-card">
        <div className="logo-area">
          <div className="logo-box">N</div>
          <h1>Nexus</h1>
          <p>Connecting tasks, teams, and goals</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {isForgotPassword ? (
          // --- FORGOT PASSWORD FLOW ---
          <>
            {forgotStep === 'EMAIL' && (
              <>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Forgot Password</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Enter your email to receive a password reset code</p>
                </div>
                <form onSubmit={handleForgotEmailSubmit}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="forgot-email">Email Address</label>
                    <input
                      id="forgot-email"
                      className="form-input"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={loading}>
                    {loading ? 'Sending Code...' : 'Send Reset Code'}
                  </button>
                </form>
                <div className="auth-footer">
                  <p><a href="#" onClick={(e) => { e.preventDefault(); setIsForgotPassword(false); setError(''); }}>Back to Login</a></p>
                </div>
              </>
            )}

            {forgotStep === 'OTP' && (
              <div className="otp-container">
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>Verify Reset Code</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Enter the 6-digit password reset code sent to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
                  </p>
                </div>

                {!emailSent && (
                  <div className="otp-demo-badge">
                    🧪 [DEMO MODE] Simulated OTP: <span style={{ letterSpacing: '2px', marginLeft: '4px', color: '#fff', fontWeight: 800 }}>{generatedOtp}</span>
                  </div>
                )}

                {emailSent && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', textAlign: 'center', width: '100%' }}>
                    💡 Tip: Check your Spam/Junk folder if you don't see the code.
                  </div>
                )}

                {otpError && <div className="auth-error" style={{ width: '100%', textAlign: 'center' }}>{otpError}</div>}

                <form onSubmit={handleForgotOtpSubmit} style={{ width: '100%' }}>
                  <div className="otp-inputs">
                    {enteredOtp.map((digit, index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        ref={el => { otpRefs.current[index] = el; }}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleOtpChange(e.target.value, index)}
                        onKeyDown={e => handleOtpKeyDown(e, index)}
                        onPaste={handleOtpPaste}
                        className="otp-input"
                        disabled={loading}
                        autoComplete="off"
                        aria-label={`Digit ${index + 1} of verification code`}
                        title={`Digit ${index + 1} of verification code`}
                        placeholder="-"
                      />
                    ))}
                  </div>

                  <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: '12px' }}>
                    Verify Reset Code
                  </button>
                </form>

                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '13px', marginTop: '4px' }}>
                  <a href="#" style={{ color: 'var(--text-muted)' }} onClick={(e) => { e.preventDefault(); generateAndSendOtp(email); }}>
                    Resend Code
                  </a>
                  <a href="#" style={{ color: 'var(--purple)', fontWeight: 600 }} onClick={(e) => { e.preventDefault(); setForgotStep('EMAIL'); }}>
                    Back to Step 1
                  </a>
                </div>
              </div>
            )}

            {forgotStep === 'RESET' && (
              <>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Reset Password</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Choose a secure password for <strong style={{ color: 'var(--text-primary)' }}>{email}</strong></p>
                </div>
                <form onSubmit={handleForgotResetPasswordSubmit}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reset-password">New Password</label>
                    <input
                      id="reset-password"
                      className="form-input"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reset-confirm-password">Confirm Password</label>
                    <input
                      id="reset-confirm-password"
                      className="form-input"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={loading}>
                    {loading ? 'Updating Password...' : 'Update Password'}
                  </button>
                </form>
              </>
            )}
          </>
        ) : !isSignUp ? (
          // --- REGULAR LOGIN FORM ---
          <>
            <form onSubmit={handleSignInSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  className="form-input"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" htmlFor="login-password">Password</label>
                  <a 
                    href="#" 
                    style={{ fontSize: '12px', color: 'var(--purple)', fontWeight: 600, marginBottom: '6px' }}
                    onClick={(e) => { e.preventDefault(); setIsForgotPassword(true); setForgotStep('EMAIL'); setError(''); setEmail(''); }}
                  >
                    Forgot Password?
                  </a>
                </div>
                <input
                  id="login-password"
                  className="form-input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading}>
                {loading ? 'Please wait...' : 'Sign In'}
              </button>
            </form>

            <div className="auth-footer">
              <p>Don&apos;t have an account? <a href="#" onClick={(e) => { e.preventDefault(); setIsSignUp(true); setSignUpStep('DETAILS'); setError(''); }}>Sign up</a></p>
            </div>
          </>
        ) : (
          // --- STEP-BASED SIGNUP FLOW ---
          <>
            {signUpStep === 'DETAILS' && (
              <>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Create Your Account</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Step 1: Enter your personal details to receive an OTP code</p>
                </div>
                <form onSubmit={handleDetailsSubmit}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="signup-name">Full Name</label>
                    <input
                      id="signup-name"
                      className="form-input"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="signup-email">Email</label>
                    <input
                      id="signup-email"
                      className="form-input"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={loading}>
                    {loading ? 'Sending Code...' : 'Send Verification Code'}
                  </button>
                </form>

                <div className="auth-footer">
                  <p>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setIsSignUp(false); setError(''); }}>Sign in</a></p>
                </div>
              </>
            )}

            {signUpStep === 'OTP' && (
              <div className="otp-container">
                <div style={{ textAlign: 'center' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>Verify Your Email</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Step 2: Enter the 6-digit confirmation code sent to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
                  </p>
                </div>

                {!emailSent && (
                  <div className="otp-demo-badge">
                    🧪 [DEMO MODE] Simulated OTP: <span style={{ letterSpacing: '2px', marginLeft: '4px', color: '#fff', fontWeight: 800 }}>{generatedOtp}</span>
                  </div>
                )}

                {emailSent && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '6px', textAlign: 'center', width: '100%' }}>
                    💡 Tip: If you don't see the email, please check your Spam/Junk folder.
                  </div>
                )}

                {otpError && <div className="auth-error" style={{ width: '100%', textAlign: 'center' }}>{otpError}</div>}

                <form onSubmit={handleVerifyOtp} style={{ width: '100%' }}>
                  <div className="otp-inputs">
                    {enteredOtp.map((digit, index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        ref={el => { otpRefs.current[index] = el; }}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleOtpChange(e.target.value, index)}
                        onKeyDown={e => handleOtpKeyDown(e, index)}
                        onPaste={handleOtpPaste}
                        className="otp-input"
                        disabled={loading}
                        autoComplete="off"
                        aria-label={`Digit ${index + 1} of verification code`}
                        title={`Digit ${index + 1} of verification code`}
                        placeholder="-"
                      />
                    ))}
                  </div>

                  <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: '12px' }}>
                    Verify & Confirm
                  </button>
                </form>

                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '13px', marginTop: '4px' }}>
                  <a href="#" style={{ color: 'var(--text-muted)' }} onClick={(e) => { e.preventDefault(); generateAndSendOtp(email); }}>
                    Resend Code
                  </a>
                  <a href="#" style={{ color: 'var(--purple)', fontWeight: 600 }} onClick={(e) => { e.preventDefault(); setSignUpStep('DETAILS'); }}>
                    Back to Step 1
                  </a>
                </div>
              </div>
            )}

            {signUpStep === 'PASSWORD' && (
              <>
                <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>Set Your Password</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Step 3: Secure your account for <strong style={{ color: 'var(--text-primary)' }}>{email}</strong></p>
                </div>
                <form onSubmit={handlePasswordSubmit}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="create-password">Create Password</label>
                    <input
                      id="create-password"
                      className="form-input"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
                    <input
                      id="confirm-password"
                      className="form-input"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={loading}>
                    {loading ? 'Completing Registration...' : 'Complete Registration'}
                  </button>
                </form>

                <div style={{ textAlign: 'center', width: '100%', fontSize: '13px', marginTop: '16px' }}>
                  <a href="#" style={{ color: 'var(--text-muted)' }} onClick={(e) => { e.preventDefault(); setSignUpStep('OTP'); setError(''); }}>
                    Back to Verification
                  </a>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

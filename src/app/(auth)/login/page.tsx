'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { error: err } = await signUp(email, password, fullName);
        if (err) { setError(err.message); setLoading(false); return; }
        setError('');
        alert('Account created! Please check your email to verify, then sign in.');
        setIsSignUp(false);
      } else {
        const { error: err } = await signIn(email, password);
        if (err) { setError(err.message); setLoading(false); return; }
        router.push('/dashboard');
      }
    } catch {
      setError('An unexpected error occurred');
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-orb-3" />
      <div className="auth-card glass-card">
        <div className="logo-area">
          <div className="logo-box">N</div>
          <h1>Nexus</h1>
          <p>Connecting tasks, teams, and goals</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {isSignUp && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          {isSignUp ? (
            <p>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setIsSignUp(false); }}>Sign in</a></p>
          ) : (
            <p>Don&apos;t have an account? <a href="#" onClick={(e) => { e.preventDefault(); setIsSignUp(true); }}>Sign up</a></p>
          )}
        </div>
      </div>
    </div>
  );
}

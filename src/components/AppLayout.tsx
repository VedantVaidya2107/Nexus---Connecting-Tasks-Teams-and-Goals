'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import AIAssistant from '@/components/AIAssistant';
import DynamicBackground from '@/components/DynamicBackground';
import QuoteFooter from '@/components/QuoteFooter';
import toast from 'react-hot-toast';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, updateProfile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Force-change-password modal state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [changeError, setChangeError] = useState('');

  React.useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError('');

    if (newPassword.length < 6) {
      setChangeError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setChangeError('Passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, newPassword }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to change password.');
      }

      // Update local profile state to clear the flag without refetching
      await updateProfile({ must_change_password: false });
      toast.success('🎉 Password updated successfully! Welcome to Nexus.');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setChangeError(err.message || 'An unexpected error occurred.');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;
  if (!user) return null;

  const mustChangePassword = profile?.must_change_password === true;

  return (
    <div className="app-layout">
      <DynamicBackground />
      <Sidebar />
      <Header title="Nexus" />
      <main className="main-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            style={{ minHeight: '100%', width: '100%' }}
          >
            {children}
            <QuoteFooter />
          </motion.div>
        </AnimatePresence>
      </main>
      <AIAssistant />

      {/* Force Password Change Modal */}
      <AnimatePresence>
        {mustChangePassword && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(8px)',
              padding: '20px',
            }}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.88, opacity: 0, y: 30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid rgba(124, 58, 237, 0.4)',
                borderRadius: '16px',
                padding: '36px 32px',
                width: '100%',
                maxWidth: '440px',
                boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.2)',
              }}
            >
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '26px',
                  margin: '0 auto 16px',
                  boxShadow: '0 8px 24px rgba(124,58,237,0.4)',
                }}>
                  🔐
                </div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                  Set Your Password
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                  Your account was created with a temporary password. Please set a new secure password to continue.
                </p>
              </div>

              {changeError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '13px',
                  color: '#f87171',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  ⚠️ {changeError}
                </div>
              )}

              <form onSubmit={handleChangePassword}>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label
                    htmlFor="force-new-password"
                    className="form-label"
                    style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}
                  >
                    New Password
                  </label>
                  <input
                    id="force-new-password"
                    className="form-input"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    autoFocus
                    style={{ width: '100%' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label
                    htmlFor="force-confirm-password"
                    className="form-label"
                    style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}
                  >
                    Confirm Password
                  </label>
                  <input
                    id="force-confirm-password"
                    className="form-input"
                    type="password"
                    placeholder="••••••••"
                    value={confirmNewPassword}
                    onChange={e => setConfirmNewPassword(e.target.value)}
                    required
                    minLength={6}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Password strength hint */}
                {newPassword.length > 0 && newPassword.length < 6 && (
                  <p style={{ fontSize: '12px', color: '#f59e0b', marginTop: '-16px', marginBottom: '16px' }}>
                    ⚡ Use at least 6 characters
                  </p>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={changingPassword}
                  style={{ width: '100%', padding: '12px', fontSize: '15px', fontWeight: 700 }}
                >
                  {changingPassword ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                      Updating Password...
                    </span>
                  ) : 'Set New Password'}
                </button>
              </form>

              <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '16px', marginBottom: 0 }}>
                🔒 Your password is encrypted and stored securely.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

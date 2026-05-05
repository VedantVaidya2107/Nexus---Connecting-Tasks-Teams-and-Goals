'use client';

import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { profile, updateProfile, signOut } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [jobTitle, setJobTitle] = useState(profile?.job_title || '');
  const [department, setDepartment] = useState(profile?.department || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await updateProfile({ full_name: fullName, job_title: jobTitle, department, phone });
    toast.success('Profile updated');
    setSaving(false);
  };

  return (
    <AppLayout>
      <div className="page-header"><div><h1>Settings</h1><div className="subtitle">Manage your account</div></div></div>

      <div style={{ maxWidth: '600px' }}>
        <div className="glass-card" style={{ padding: '28px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>Profile</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <div className="user-avatar" style={{ width: 64, height: 64, fontSize: 24 }}>
              {fullName ? fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??'}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '18px' }}>{fullName || 'Your Name'}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{profile?.role?.replace('_', ' ')}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{profile?.email}</div>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" value={fullName} onChange={e => setFullName(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Job Title</label><input className="form-input" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Senior Developer" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group"><label className="form-label">Department</label><input className="form-input" value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Engineering" /></div>
            <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567 890" /></div>
          </div>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>

        <div className="glass-card" style={{ padding: '28px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>Account</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Sign out of your account or manage your session.</p>
          <button className="btn btn-danger" onClick={signOut}>Sign Out</button>
        </div>
      </div>
    </AppLayout>
  );
}

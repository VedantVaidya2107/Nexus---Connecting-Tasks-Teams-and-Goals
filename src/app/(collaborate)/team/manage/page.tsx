'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import type { Profile, UserRole } from '@/lib/types';
import toast from 'react-hot-toast';

export default function TeamManagePage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Editing State
  const [editingMember, setEditingMember] = useState<Profile | null>(null);

  // Success Credentials State for new member creation
  const [createdMember, setCreatedMember] = useState<{
    fullName: string;
    email: string;
    password?: string;
    emailSent: boolean;
  } | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('team_member');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [password, setPassword] = useState('');

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setMembers(data as Profile[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      toast.error('Access Denied: Admin privileges required');
      router.push('/dashboard');
      return;
    }
    fetchMembers();
  }, [profile, router, fetchMembers]);

  const handleEditClick = (member: Profile) => {
    setEditingMember(member);
    setFullName(member.full_name);
    setEmail(member.email);
    setRole(member.role);
    setDepartment(member.department || '');
    setJobTitle(member.job_title || '');
    setPassword(''); // Leave password blank, optional on edit
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setEditingMember(null);
    setFullName('');
    setEmail('');
    setRole('team_member');
    setDepartment('');
    setJobTitle('');
    setPassword('');
    setShowModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingMember) {
        // Edit flow
        const response = await fetch('/api/admin/update-member', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingMember.id,
            fullName,
            email,
            role,
            department,
            jobTitle,
            password: password || undefined, // Password is optional on edit
            updatedBy: profile?.id
          })
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || 'Failed to update member');
        }

        toast.success(`${fullName} updated successfully`);
      } else {
        // Add flow
        const response = await fetch('/api/admin/add-member', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName,
            email,
            role,
            department,
            jobTitle,
            password,
            createdBy: profile?.id
          })
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || 'Failed to add member');
        }

        toast.success(`${fullName} added successfully`);
        
        // Save created member info to show the beautiful credential copy popup
        if (result.success && result.data) {
          setCreatedMember({
            fullName,
            email,
            password: result.data.password || password,
            emailSent: !!result.data.emailSent
          });
        }
      }

      handleCloseModal();
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = async (member: Profile) => {
    if (member.id === profile?.id) {
      toast.error('You cannot delete your own admin account.');
      return;
    }

    const confirmed = window.confirm(
      `⚠️ Are you sure you want to permanently delete ${member.full_name}? This action will completely remove them from the system and cannot be undone.`
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await fetch('/api/admin/delete-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: member.id,
          deletedBy: profile?.id,
          fullName: member.full_name
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Failed to delete member');
      }

      toast.success(`${member.full_name} deleted successfully`);
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete member.');
      setLoading(false);
    }
  };

  const toggleStatus = async (member: Profile) => {
    const { error } = await supabase.from('profiles').update({ is_active: !member.is_active }).eq('id', member.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`User ${member.is_active ? 'deactivated' : 'activated'}`);
      fetchMembers();
    }
  };

  if (loading || (profile && profile.role !== 'admin')) {
    return <AppLayout><div className="loading-page"><div className="spinner" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1>Team Management</h1>
          <div className="subtitle">Manage organization roles and permissions</div>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingMember(null); setShowModal(true); }}>
          <span>➕</span> Add Team Member
        </button>
      </div>

      <div className="filter-bar" style={{ marginBottom: '20px' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '300px' }}>
          <input 
            aria-label="Search by name or email"
            placeholder="Search by name or email..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
              <th>Joined</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members
              .filter(m => 
                m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                m.email.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map(m => (
              <tr key={m.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="user-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                      {m.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{m.full_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="badge" style={{ 
                    background: (m.role === 'admin' ? 'var(--purple)' : m.role === 'manager' ? 'var(--blue)' : 'var(--text-muted)') + '20',
                    color: m.role === 'admin' ? 'var(--purple)' : m.role === 'manager' ? 'var(--blue)' : 'var(--text-muted)'
                  }}>
                    {m.role.replace('_', ' ')}
                  </span>
                </td>
                <td>{m.department || '—'}</td>
                <td>
                  <span className={`badge ${m.is_active ? 'badge-active' : 'badge-inactive'}`} style={{
                    background: (m.is_active ? 'var(--green)' : 'var(--red)') + '20',
                    color: m.is_active ? 'var(--green)' : 'var(--red)'
                  }}>
                    {m.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {new Date(m.created_at).toLocaleDateString()}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="btn-ghost btn-sm" onClick={() => handleEditClick(m)} title="Edit Member">
                      ✏️
                    </button>
                    <button className="btn-ghost btn-sm" onClick={() => toggleStatus(m)} title={m.is_active ? 'Deactivate' : 'Activate'}>
                      {m.is_active ? '🚫' : '✅'}
                    </button>
                    <button className="btn-ghost btn-sm" onClick={() => handleDeleteClick(m)} title="Delete Member" style={{ color: 'var(--red)' }}>
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal glass-card" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>{editingMember ? 'Edit Team Member' : 'Add Team Member'}</h2>
              <button className="btn-ghost" onClick={handleCloseModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="fullName" className="form-label">Full Name*</label>
                  <input id="fullName" className="form-input" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="e.g. Sarah Wilson" />
                </div>
                <div className="form-group">
                  <label htmlFor="email" className="form-label">Email Address*</label>
                  <input id="email" className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="sarah@company.com" />
                </div>
                <div className="form-group">
                  <label htmlFor="role" className="form-label">Role*</label>
                  <select id="role" className="form-select" value={role} onChange={e => setRole(e.target.value as UserRole)}>
                    <option value="team_member">Team Member</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Admins have full access, Managers oversee teams, Members manage own tasks.
                  </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label htmlFor="department" className="form-label">Department</label>
                    <select id="department" className="form-select" value={department} onChange={e => setDepartment(e.target.value)}>
                      <option value="">Select...</option>
                      <option value="Engineering">Engineering</option>
                      <option value="Design">Design</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Sales">Sales</option>
                      <option value="Operations">Operations</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="jobTitle" className="form-label">Job Title</label>
                    <input id="jobTitle" className="form-input" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Lead Designer" />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="password" className="form-label">
                    {editingMember ? 'Reset Password (Optional)' : 'Temporary Password*'}
                  </label>
                  <input 
                    id="password" 
                    className="form-input" 
                    type="password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required={!editingMember} 
                    minLength={6} 
                    placeholder={editingMember ? 'Leave blank to keep current password' : '••••••••'} 
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (editingMember ? 'Saving Changes...' : 'Adding Member...') : (editingMember ? 'Save Changes' : 'Add Member')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {createdMember && (
        <div className="modal-overlay">
          <div className="modal glass-card" style={{ maxWidth: '460px', padding: '36px 32px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '16px',
                background: createdMember.emailSent 
                  ? 'linear-gradient(135deg, var(--green) 0%, #059669 100%)' 
                  : 'linear-gradient(135deg, var(--amber) 0%, #d97706 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                margin: '0 auto 16px',
                boxShadow: createdMember.emailSent 
                  ? '0 8px 24px rgba(16,185,129,0.3)' 
                  : '0 8px 24px rgba(245,158,11,0.3)',
              }}>
                {createdMember.emailSent ? '✉️' : '🧪'}
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                {createdMember.emailSent ? 'Welcome Email Sent!' : 'Account Created (Demo Mode)'}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                {createdMember.emailSent 
                  ? `An email with a temporary password was sent successfully to ${createdMember.fullName}.`
                  : `⚠️ SMTP is not configured in your .env.local file, so the email could not be delivered. Copy the credentials below to log in and test:`}
              </p>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
            }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Full Name</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{createdMember.fullName}</div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Email Address</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff', wordBreak: 'break-all' }}>{createdMember.email}</span>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => {
                      navigator.clipboard.writeText(createdMember.email);
                      toast.success('Email address copied!');
                    }}
                    style={{ padding: '4px 8px', borderRadius: '6px', flexShrink: 0 }}
                  >
                    📋 Copy
                  </button>
                </div>
              </div>

              {createdMember.password && (
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Temporary Password</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <code style={{ fontSize: '16px', fontWeight: 700, color: 'var(--purple)', fontFamily: 'monospace', letterSpacing: '1px' }}>
                      {createdMember.password}
                    </code>
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm" 
                      onClick={() => {
                        if (createdMember.password) {
                          navigator.clipboard.writeText(createdMember.password);
                          toast.success('Temporary password copied!');
                        }
                      }}
                      style={{ padding: '4px 8px', borderRadius: '6px', flexShrink: 0 }}
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => setCreatedMember(null)}
                style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
              >
                Close & Continue
              </button>
              
              {!createdMember.emailSent && (
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
                  💡 To enable real emails, please set <strong>SMTP_USER</strong> and <strong>SMTP_PASS</strong> in your <strong>.env.local</strong> file.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

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

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // In a real app, we'd call a server action or edge function with Service Role key
      // to create the user in Auth. For this demo, we'll simulate the call or use a placeholder.
      // NOTE: Creating users via client-side supabase.auth is not possible for others.
      
      const response = await fetch('/api/admin/add-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName, email, role, department, jobTitle, password,
          createdBy: profile?.id
        })
      });

      const contentType = response.headers.get('content-type');
      let result;
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Server returned ${response.status}: ${response.statusText}. Check server logs.`);
      }

      if (!response.ok) {
        throw new Error(result.message || 'Failed to add member');
      }

      toast.success(`${fullName} added successfully`);
      setShowModal(false);
      fetchMembers();
      // Reset form
      setFullName(''); setEmail(''); setRole('team_member'); setDepartment(''); setJobTitle(''); setPassword('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
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
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <span>➕</span> Add Team Member
        </button>
      </div>

      <div className="filter-bar" style={{ marginBottom: '20px' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: '300px' }}>
          <input 
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
                  <button className="btn-ghost btn-sm" onClick={() => toggleStatus(m)} title={m.is_active ? 'Deactivate' : 'Activate'}>
                    {m.is_active ? '🚫' : '✅'}
                  </button>
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
              <h2>Add Team Member</h2>
              <button className="btn-ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddMember}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name*</label>
                  <input className="form-input" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="e.g. Sarah Wilson" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address*</label>
                  <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="sarah@company.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Role*</label>
                  <select className="form-select" value={role} onChange={e => setRole(e.target.value as UserRole)}>
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
                    <label className="form-label">Department</label>
                    <select className="form-select" value={department} onChange={e => setDepartment(e.target.value)}>
                      <option value="">Select...</option>
                      <option value="Engineering">Engineering</option>
                      <option value="Design">Design</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Sales">Sales</option>
                      <option value="Operations">Operations</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Job Title</label>
                    <input className="form-input" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Lead Designer" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Temporary Password*</label>
                  <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Adding Member...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

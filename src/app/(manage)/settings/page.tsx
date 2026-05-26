'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { profile, updateProfile, signOut } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [jobTitle, setJobTitle] = useState(profile?.job_title || '');
  const [department, setDepartment] = useState(profile?.department || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);

  // WiFi Settings (admin only)
  const [wifiNetworkName, setWifiNetworkName] = useState('Office Network');
  const [wifiIPs, setWifiIPs] = useState('');
  const [myCurrentIP, setMyCurrentIP] = useState<string | null>(null);
  const [wifiLoading, setWifiLoading] = useState(false);
  const [wifiSaving, setWifiSaving] = useState(false);

  const isAdmin = profile?.role === 'admin';

  const save = async () => {
    setSaving(true);
    await updateProfile({ full_name: fullName, job_title: jobTitle, department, phone });
    toast.success('Profile updated');
    setSaving(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    const fetchWifi = async () => {
      setWifiLoading(true);
      try {
        const res = await fetch('/api/admin/wifi-settings');
        const data = await res.json();
        if (data.success) {
          setWifiNetworkName(data.settings?.network_name || 'Office Network');
          setWifiIPs((data.settings?.allowed_ips || []).join('\n'));
          setMyCurrentIP(data.your_current_ip || null);
        }
      } finally {
        setWifiLoading(false);
      }
    };
    fetchWifi();
  }, [isAdmin]);

  const saveWifi = async () => {
    setWifiSaving(true);
    try {
      const ips = wifiIPs
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const res = await fetch('/api/admin/wifi-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network_name: wifiNetworkName, allowed_ips: ips }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('✅ WiFi settings saved!');
        setWifiIPs((data.settings?.allowed_ips || []).join('\n'));
      } else {
        toast.error(data.message || 'Failed to save.');
      }
    } catch {
      toast.error('Failed to save WiFi settings.');
    } finally {
      setWifiSaving(false);
    }
  };

  const addMyIP = () => {
    if (!myCurrentIP) return;
    const current = wifiIPs.split('\n').map(s => s.trim()).filter(Boolean);
    if (current.includes(myCurrentIP)) {
      toast('Your IP is already in the list.', { icon: 'ℹ️' });
      return;
    }
    setWifiIPs(prev => prev ? prev + '\n' + myCurrentIP : myCurrentIP);
    toast.success(`Added your IP: ${myCurrentIP}`);
  };

  return (
    <AppLayout>
      <div className="page-header"><div><h1>Settings</h1><div className="subtitle">Manage your account</div></div></div>

      <div style={{ maxWidth: '640px' }}>
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card"
          style={{ padding: '28px', marginBottom: '24px' }}
        >
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
        </motion.div>

        {/* WiFi Security Settings (Admin Only) */}
        {isAdmin && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card"
            style={{ padding: '28px', marginBottom: '24px' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📶 WiFi Security
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.6 }}>
                  Configure which IP addresses are considered &quot;office network.&quot; Employees must be on this network to check in or out.
                </p>
              </div>
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px',
                background: 'rgba(124,58,237,0.12)', color: '#a78bfa',
                border: '1px solid rgba(124,58,237,0.25)', whiteSpace: 'nowrap',
              }}>
                Admin Only
              </span>
            </div>

            {wifiLoading ? (
              <div style={{ padding: '20px 0', textAlign: 'center' }}><div className="spinner" /></div>
            ) : (
              <>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Network Name</label>
                  <input
                    className="form-input"
                    value={wifiNetworkName}
                    onChange={e => setWifiNetworkName(e.target.value)}
                    placeholder="e.g. Fristine Office WiFi"
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    This is a display label shown to employees — it doesn&apos;t affect validation.
                  </p>
                </div>

                {/* Current IP helper */}
                {myCurrentIP && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(59,130,246,0.08)',
                    border: '1px solid rgba(59,130,246,0.25)',
                    borderRadius: '10px', padding: '12px 14px', marginBottom: '16px',
                    gap: '12px', flexWrap: 'wrap',
                  }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#60a5fa', marginBottom: '2px' }}>
                        📍 Your current IP address
                      </div>
                      <code style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {myCurrentIP}
                      </code>
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={addMyIP}
                      style={{ fontSize: '12px', padding: '7px 14px' }}
                    >
                      ➕ Add to list
                    </button>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Allowed IPs / CIDR Ranges</label>
                  <textarea
                    className="form-input"
                    value={wifiIPs}
                    onChange={e => setWifiIPs(e.target.value)}
                    rows={6}
                    placeholder={'Enter one per line:\n192.168.1.1\n192.168.1.0/24\n10.0.0.0/8'}
                    style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '13px', lineHeight: 1.7 }}
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.6 }}>
                    Enter one IP or CIDR range per line. Examples: <code>192.168.1.50</code> (exact), <code>192.168.1.0/24</code> (subnet), <code>10.0.0.0/8</code> (range).
                    Leave empty to block all check-ins until configured.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    className="btn btn-primary"
                    onClick={saveWifi}
                    disabled={wifiSaving}
                  >
                    {wifiSaving ? 'Saving...' : '💾 Save WiFi Settings'}
                  </button>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Changes take effect immediately on next check-in attempt.
                  </span>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* Account Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card"
          style={{ padding: '28px' }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>Account</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Sign out of your account or manage your session.</p>
          <button className="btn btn-danger" onClick={signOut}>Sign Out</button>
        </motion.div>
      </div>
    </AppLayout>
  );
}

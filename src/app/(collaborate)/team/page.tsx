'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/lib/supabase';
import type { Profile, Task } from '@/lib/types';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function TeamPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [mRes, tRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
      supabase.from('tasks').select('id, assignee_id, status, priority'),
    ]);
    if (mRes.data) setMembers(mRes.data as Profile[]);
    if (tRes.data) setTasks(tRes.data as Task[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <AppLayout><div className="loading-page"><div className="spinner" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Team</h1>
          <div className="subtitle">{members.length} members</div>
        </div>
        {profile?.role === 'admin' && (
          <button 
            type="button"
            className="btn btn-primary"
            onClick={() => router.push('/team/manage')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <span>🛡️</span> Manage Team
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {members.map((m, index) => {
          const mTasks = tasks.filter(t => t.assignee_id === m.id);
          const done = mTasks.filter(t => t.status === 'done').length;
          const inProg = mTasks.filter(t => t.status === 'in_progress').length;
          const rate = mTasks.length > 0 ? Math.round((done / mTasks.length) * 100) : 0;
          const initials = m.full_name ? m.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';
          return (
            <motion.div 
              key={m.id} 
              className="glass-card" 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.4 }}
              whileHover={{ y: -5, boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
              style={{ padding: '24px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <div className="user-avatar" style={{ width: 48, height: 48, fontSize: 16 }}>{initials}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{m.full_name || 'Unknown'}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{m.role?.replace('_', ' ')} {m.job_title ? `• ${m.job_title}` : ''}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '14px' }}>
                <div style={{ textAlign: 'center', padding: '10px', background: 'var(--bg-hover)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800 }}>{mTasks.length}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total</div>
                </div>
                <div style={{ textAlign: 'center', padding: '10px', background: 'var(--bg-hover)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--blue)' }}>{inProg}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Active</div>
                </div>
                <div style={{ textAlign: 'center', padding: '10px', background: 'var(--bg-hover)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--green)' }}>{done}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Done</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Completion</span>
                <span style={{ fontWeight: 600 }}>{rate}%</span>
              </div>
              <div className="progress-bar">
                <motion.div 
                  className="fill" 
                  initial={{ width: 0 }} 
                  animate={{ width: `${rate}%` }} 
                  transition={{ delay: 0.2 + (index * 0.05), duration: 0.8, ease: "easeOut" }} 
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      {members.length === 0 && (
        <div className="empty-state"><div className="empty-icon">👥</div><h3>No team members</h3><p>Team members will appear after they sign up.</p></div>
      )}
    </AppLayout>
  );
}

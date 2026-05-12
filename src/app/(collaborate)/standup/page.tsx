'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { DailyUpdate, Profile, Task } from '@/lib/types';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function StandupPage() {
  const { user, profile } = useAuth();
  const [updates, setUpdates] = useState<(DailyUpdate & { user?: Profile })[]>([]);
  const [myUpdate, setMyUpdate] = useState<DailyUpdate | null>(null);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [yesterday, setYesterday] = useState('');
  const [today, setToday] = useState('');
  const [blockers, setBlockers] = useState('');
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchData = useCallback(async () => {
    if (!profile) return;

    let updatesQuery = supabase.from('daily_updates').select('*, user:profiles(*)').eq('date', todayStr).order('created_at');
    
    // Privacy: Members only see their own updates
    if (profile.role === 'team_member') {
      updatesQuery = updatesQuery.eq('user_id', user?.id);
    }

    const [allRes, myRes, tasksRes] = await Promise.all([
      updatesQuery,
      user ? supabase.from('daily_updates').select('*').eq('user_id', user.id).eq('date', todayStr).maybeSingle() : Promise.resolve({ data: null }),
      user ? supabase.from('tasks').select('*').eq('assignee_id', user.id).in('status', ['pending', 'in_progress', 'awaiting_zoho', 'awaiting_client', 'awaiting_team']) : Promise.resolve({ data: null }),
    ]);
    if (allRes.data) setUpdates(allRes.data as (DailyUpdate & { user?: Profile })[]);
    if (myRes.data) {
      setMyUpdate(myRes.data as DailyUpdate);
      setYesterday((myRes.data as DailyUpdate).completed_yesterday || '');
      setToday((myRes.data as DailyUpdate).planned_today || '');
      setBlockers((myRes.data as DailyUpdate).blockers || '');
    }
    if (tasksRes.data) {
      setMyTasks(tasksRes.data as Task[]);
    }
    setLoading(false);
  }, [user, profile, todayStr]);

  useEffect(() => { 
    if (profile) fetchData(); 
  }, [fetchData, profile]);

  const saveUpdate = async () => {
    const payload = { user_id: user!.id, date: todayStr, completed_yesterday: yesterday, planned_today: today, blockers };
    if (myUpdate) {
      await supabase.from('daily_updates').update(payload).eq('id', myUpdate.id);
    } else {
      await supabase.from('daily_updates').insert(payload);
    }
    toast.success('Standup saved!');
    fetchData();
  };

  if (loading) return <AppLayout><div className="loading-page"><div className="spinner" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="page-header"><div><h1>Daily Standup</h1><div className="subtitle">{new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</div></div></div>

      {/* My Update Form */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ padding: '28px', marginBottom: '28px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>📝 Your Update {myUpdate ? '(Saved ✓)' : ''}</h3>
        <div className="form-group">
          <label className="form-label">✅ What did you complete yesterday?</label>
          <textarea className="form-textarea" value={yesterday} onChange={e => setYesterday(e.target.value)} placeholder="List your completions..." style={{ minHeight: '80px' }} />
        </div>
        <div className="form-group">
          <label className="form-label">🎯 What are you working on today?</label>
          {myTasks.length > 0 && (
            <div style={{ marginBottom: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>Suggested from your pending tasks:</span>
              {myTasks.map(t => (
                <button 
                  key={t.id} 
                  onClick={() => setToday(prev => prev ? `${prev}\n- ${t.title}` : `- ${t.title}`)}
                  className="btn-ghost btn-sm" 
                  style={{ padding: '2px 8px', fontSize: '11px', background: 'var(--bg-hover)', border: '1px dashed var(--border)' }}
                >
                  + {t.title}
                </button>
              ))}
            </div>
          )}
          <textarea className="form-textarea" value={today} onChange={e => setToday(e.target.value)} placeholder="List your plans..." style={{ minHeight: '80px' }} />
        </div>
        <div className="form-group">
          <label className="form-label">🚧 Any blockers?</label>
          <textarea className="form-textarea" value={blockers} onChange={e => setBlockers(e.target.value)} placeholder="Describe blockers or type 'None'" style={{ minHeight: '60px' }} />
        </div>
        <button className="btn btn-primary" onClick={saveUpdate}>{myUpdate ? 'Update' : 'Submit'}</button>
      </motion.div>

      {/* Team Updates */}
      <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Team Updates ({updates.length})</h3>
      {updates.length === 0 ? (
        <motion.div className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <motion.div className="empty-icon" animate={{ y: [0, -10, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>🎯</motion.div>
          <h3>No updates yet today</h3>
          <p>Be the first to share your standup!</p>
        </motion.div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {updates.map((u, index) => (
            <motion.div 
              key={u.id} 
              className="glass-card" 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.4 }}
              style={{ padding: '20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                <div className="user-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>{u.user?.full_name?.[0] || '?'}</div>
                <div>
                  <div style={{ fontWeight: 600 }}>{u.user?.full_name || 'Unknown'}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(u.created_at).toLocaleTimeString()}</div>
                </div>
              </div>
              {u.completed_yesterday && <div style={{ marginBottom: '10px' }}><strong style={{ fontSize: '12px', color: 'var(--green)' }}>YESTERDAY:</strong><p style={{ fontSize: '13px', marginTop: '4px', lineHeight: 1.5 }}>{u.completed_yesterday}</p></div>}
              {u.planned_today && <div style={{ marginBottom: '10px' }}><strong style={{ fontSize: '12px', color: 'var(--blue)' }}>TODAY:</strong><p style={{ fontSize: '13px', marginTop: '4px', lineHeight: 1.5 }}>{u.planned_today}</p></div>}
              {u.blockers && u.blockers.toLowerCase() !== 'none' && <div><strong style={{ fontSize: '12px', color: 'var(--red)' }}>BLOCKERS:</strong><p style={{ fontSize: '13px', marginTop: '4px', lineHeight: 1.5 }}>{u.blockers}</p></div>}
            </motion.div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

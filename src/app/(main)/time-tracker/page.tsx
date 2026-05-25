'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { TimeEntry, Task, Project, Profile } from '@/lib/types';
import { createTimeEntry, updateTimeEntry, deleteTimeEntry } from '@/actions/timeEntries';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Helpers ─────────────────────────────────────────────────
function fmtDuration(minutes: number) {
  if (!minutes || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtTimer(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function todayISO() { return new Date().toISOString().split('T')[0]; }
function dateNDaysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0];
}
function daysAgo(dateStr: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.round((now.getTime() - d.getTime()) / 86400000);
}
function timeToMins(t: string): number | null {
  const match = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1]); const m = parseInt(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}
function minsToTime(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

type FilterRange = 'today' | 'this_week' | 'this_month' | 'custom' | 'all';

// ─── Billable Toggle Component ────────────────────────────────
function BillableToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        onClick={() => onChange(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
          cursor: 'pointer', transition: 'all 0.15s ease',
          border: `2px solid ${value ? '#22c55e' : 'var(--border)'}`,
          background: value ? 'rgba(34,197,94,0.12)' : 'transparent',
          color: value ? '#22c55e' : 'var(--text-muted)',
        }}
      >
        <span style={{ fontSize: 14 }}>💰</span> Billable
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
          cursor: 'pointer', transition: 'all 0.15s ease',
          border: `2px solid ${!value ? '#94a3b8' : 'var(--border)'}`,
          background: !value ? 'rgba(148,163,184,0.12)' : 'transparent',
          color: !value ? '#94a3b8' : 'var(--text-muted)',
        }}
      >
        <span style={{ fontSize: 14 }}>🚫</span> Non-billable
      </button>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────
export default function TimeTrackerPage() {
  const { user, profile } = useAuth();
  const isPrivileged = profile?.role === 'admin' || profile?.role === 'manager';

  // Data
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);       // tasks for dropdown (role-filtered)
  const [allTasks, setAllTasks] = useState<Task[]>([]);  // all tasks for admins
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterRange, setFilterRange] = useState<FilterRange>('this_week');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterProject, setFilterProject] = useState('all');
  const [filterMember, setFilterMember] = useState('all');
  const [filterBillable, setFilterBillable] = useState<'all' | 'billable' | 'non_billable'>('all');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);

  // Form - shared
  const [formTaskId, setFormTaskId] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDate, setFormDate] = useState(todayISO());
  const [formBillable, setFormBillable] = useState(true);

  const [formFromTime, setFormFromTime] = useState('09:00');
  const [formToTime, setFormToTime] = useState('');

  // Stopwatch
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerTaskId, setTimerTaskId] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Computed ─────────────────────────────────────────────────
  const computedRangeMins = (() => {
    const from = timeToMins(formFromTime);
    const to = timeToMins(formToTime);
    if (from === null || to === null || to <= from) return null;
    return to - from;
  })();

  const totalFormMins = computedRangeMins ?? 0;

  const maxPastDays = isPrivileged ? 3650 : 7;
  const minAllowedDate = dateNDaysAgo(maxPastDays);
  const dateError = (() => {
    if (!formDate) return 'Please select a date';
    if (daysAgo(formDate) < 0) return 'Cannot log time for a future date';
    if (!isPrivileged && daysAgo(formDate) > 7)
      return 'Team members can only log time within the past 7 days. Contact a manager or admin for older entries.';
    return null;
  })();

  // ── Fetch ────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!user) return;

    let entriesQuery = supabase
      .from('time_entries')
      .select('*, user:profiles(*), task:tasks(id,title,project_id)')
      .order('logged_date', { ascending: false })
      .order('created_at', { ascending: false });

    // Team members: only see their own entries
    if (!isPrivileged) entriesQuery = entriesQuery.eq('user_id', user.id);

    // Tasks for dropdown: team members only see THEIR assigned tasks
    let tasksQuery = supabase.from('tasks').select('id, title, project_id, assignee_id').order('title');
    if (!isPrivileged) tasksQuery = tasksQuery.eq('assignee_id', user.id);

    const [eRes, tRes, pRes, mRes] = await Promise.all([
      entriesQuery,
      tasksQuery,
      supabase.from('projects').select('id, name, color').eq('status', 'active'),
      supabase.from('profiles').select('id, full_name').eq('is_active', true),
    ]);

    if (eRes.data) setEntries(eRes.data as TimeEntry[]);
    if (tRes.data) {
      setTasks(tRes.data as Task[]);
      setAllTasks(tRes.data as Task[]);
    }
    if (pRes.data) setProjects(pRes.data as Project[]);
    if (mRes.data) setMembers(mRes.data as Profile[]);
    setLoading(false);
  }, [user, isPrivileged]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Stopwatch ─────────────────────────────────────────────────
  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning]);

  const startTimer = () => { setTimerSeconds(0); setTimerRunning(true); };
  const stopTimer = () => {
    setTimerRunning(false);
    if (timerSeconds < 60) { toast.error('Timer must run for at least 1 minute'); setTimerSeconds(0); return; }
    const totalMins = Math.round(timerSeconds / 60);
    openCreate(timerTaskId || undefined, totalMins);
    setTimerSeconds(0);
  };

  // ── Modal helpers ─────────────────────────────────────────────
  const resetForm = () => {
    setFormTaskId(''); setFormDesc(''); setFormDate(todayISO()); setFormBillable(true);
    setFormFromTime('09:00'); setFormToTime('');
  };

  const openCreate = (taskId?: string, prefillMins?: number) => {
    setEditEntry(null); resetForm();
    setFormTaskId(taskId || '');
    if (prefillMins) {
      const startMins = 9 * 60;
      const endMins = startMins + prefillMins;
      const endH = Math.floor(endMins / 60) % 24;
      const endM = endMins % 60;
      setFormFromTime('09:00');
      setFormToTime(`${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`);
    }
    setShowModal(true);
  };

  const openEdit = (e: TimeEntry) => {
    if (!isPrivileged && daysAgo(e.logged_date) > 7) {
      toast.error('Only managers or admins can modify time entries older than 7 days');
      return;
    }
    setEditEntry(e);
    setFormTaskId(e.task_id || ''); setFormDesc(e.description || '');
    setFormDate(e.logged_date); setFormBillable(e.is_billable ?? true);
    
    // Map duration_minutes to a From-To range starting at 09:00
    const startMins = 9 * 60;
    const endMins = startMins + e.duration_minutes;
    const endH = Math.floor(endMins / 60) % 24;
    const endM = endMins % 60;
    setFormFromTime('09:00');
    setFormToTime(`${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`);
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditEntry(null); };

  // ── Save ──────────────────────────────────────────────────────
  const saveEntry = async () => {
    if (dateError) { toast.error(dateError); return; }
    if (totalFormMins <= 0) {
      toast.error('Set a valid From–To time range');
      return;
    }

    if (!formDesc.trim()) {
      toast.error('Description is required');
      return;
    }

    const payload = {
      task_id: formTaskId || null,
      duration_minutes: totalFormMins,
      description: formDesc.trim() || null,
      logged_date: formDate,
      is_billable: formBillable,
    };

    if (editEntry) {
      const res = await updateTimeEntry(editEntry.id, payload, user!.id, editEntry.duration_minutes, editEntry.task_id);
      if (!res.success) { toast.error(res.message || 'Error'); return; }
      toast.success('Time entry updated');
    } else {
      const res = await createTimeEntry(payload, user!.id);
      if (!res.success) { toast.error(res.message || 'Error'); return; }
      toast.success('Time logged successfully');
    }
    closeModal(); fetchAll();
  };

  const removeEntry = async (e: TimeEntry) => {
    if (!isPrivileged && daysAgo(e.logged_date) > 7) {
      toast.error('Only managers or admins can delete time entries older than 7 days');
      return;
    }
    if (!confirm('Delete this time entry?')) return;
    const res = await deleteTimeEntry(e.id, user!.id, e.duration_minutes, e.task_id);
    if (!res.success) { toast.error(res.message || 'Error'); return; }
    toast.success('Time entry deleted'); fetchAll();
  };

  // ── Filter ────────────────────────────────────────────────────
  const filtered = entries.filter(e => {
    const date = new Date(e.logged_date); const now = new Date();
    if (filterRange === 'today') { if (e.logged_date !== todayISO()) return false; }
    else if (filterRange === 'this_week') {
      const s = new Date(now); s.setDate(now.getDate() - now.getDay()); s.setHours(0, 0, 0, 0);
      if (date < s) return false;
    } else if (filterRange === 'this_month') {
      if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return false;
    }
    else if (filterRange === 'custom') {
      if (filterStartDate) {
        const start = new Date(filterStartDate);
        start.setHours(0, 0, 0, 0);
        if (date < start) return false;
      }
      if (filterEndDate) {
        const end = new Date(filterEndDate);
        end.setHours(23, 59, 59, 999);
        if (date > end) return false;
      }
    }
    if (filterMember !== 'all' && e.user_id !== filterMember) return false;
    if (filterProject !== 'all' && (e.task as any)?.project_id !== filterProject) return false;
    if (filterBillable === 'billable' && !e.is_billable) return false;
    if (filterBillable === 'non_billable' && e.is_billable) return false;
    return true;
  });

  // ── Summaries ──────────────────────────────────────────────────
  const totalMins = filtered.reduce((s, e) => s + e.duration_minutes, 0);
  const billableMins = filtered.filter(e => e.is_billable).reduce((s, e) => s + e.duration_minutes, 0);
  const nonBillableMins = filtered.filter(e => !e.is_billable).reduce((s, e) => s + e.duration_minutes, 0);
  const todayMins = entries.filter(e => e.logged_date === todayISO() && (isPrivileged || e.user_id === user?.id)).reduce((s, e) => s + e.duration_minutes, 0);
  const weekMins = (() => {
    const now = new Date(); const s = new Date(now);
    s.setDate(now.getDate() - now.getDay()); s.setHours(0, 0, 0, 0);
    return entries.filter(e => new Date(e.logged_date) >= s && (isPrivileged || e.user_id === user?.id)).reduce((sum, e) => sum + e.duration_minutes, 0);
  })();

  const taskSummary = Object.values(
    filtered.reduce((acc, e) => {
      const key = e.task_id || 'unlinked';
      if (!acc[key]) acc[key] = { taskId: e.task_id, taskTitle: (e.task as any)?.title || 'No Task', totalMins: 0, entries: 0 };
      acc[key].totalMins += e.duration_minutes; acc[key].entries += 1; return acc;
    }, {} as Record<string, { taskId: string | null; taskTitle: string; totalMins: number; entries: number }>)
  ).sort((a, b) => b.totalMins - a.totalMins).slice(0, 5);

  if (loading) return <AppLayout><div className="loading-page"><div className="spinner" /></div></AppLayout>;

  return (
    <AppLayout>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>⏱ Time Tracker</h1>
          <div className="subtitle">Log and manage time entries linked to tasks</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => openCreate()}>＋ Log Time</button>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: "Today's Hours", value: fmtDuration(todayMins), icon: '🌅', color: '#6366f1' },
          { label: 'This Week', value: fmtDuration(weekMins), icon: '📅', color: '#06b6d4' },
          { label: '💰 Billable', value: fmtDuration(billableMins), icon: '💰', color: '#22c55e' },
          { label: '🚫 Non-Billable', value: fmtDuration(nonBillableMins), icon: '🚫', color: '#94a3b8' },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} className="glass-card"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.4 }}
            style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: kpi.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{kpi.icon}</div>
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{kpi.label}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: kpi.color, lineHeight: 1.2 }}>{kpi.value}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Stopwatch */}
      <motion.div className="glass-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, duration: 0.4 }} style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 40, fontWeight: 900, letterSpacing: '0.05em', color: timerRunning ? '#22c55e' : 'var(--text-primary)', transition: 'color 0.3s ease', minWidth: 160 }}>
              {fmtTimer(timerSeconds)}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {!timerRunning ? (
                <button className="btn btn-primary" onClick={startTimer} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>▶ Start Timer</button>
              ) : (
                <button className="btn" onClick={stopTimer} style={{ background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>⏹ Stop & Log</button>
              )}
              {timerRunning && (
                <button className="btn btn-secondary" onClick={() => { setTimerRunning(false); setTimerSeconds(0); }}>✕ Cancel</button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Timer Task:</span>
            <select className="form-select" value={timerTaskId} onChange={e => setTimerTaskId(e.target.value)}
              style={{ width: 'auto', minWidth: 200, padding: '6px 12px', fontSize: 13 }}
              aria-label="Select task for timer"
              title="Select task for timer">
              <option value="">No task (free timer)</option>
              {/* Team members only see their assigned tasks */}
              {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        </div>
        {timerRunning && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'dotPulse 1.5s infinite' }} />
            <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>Timer running…</span>
          </div>
        )}
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', alignItems: 'start' }}>
        {/* Entries Table */}
        <motion.div className="glass-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.4 }} style={{ overflow: 'hidden' }}>

          {/* Filters */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Time Entries</span>
            <div style={{ flex: 1 }} />
            {/* Billable filter */}
            <select className="form-select" style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}
              value={filterBillable} onChange={e => setFilterBillable(e.target.value as any)}
              aria-label="Filter by billing type" title="Filter by billing type">
              <option value="all">All Types</option>
              <option value="billable">💰 Billable</option>
              <option value="non_billable">🚫 Non-billable</option>
            </select>
            <select className="form-select" style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}
              value={filterRange} onChange={e => setFilterRange(e.target.value as FilterRange)}
              aria-label="Filter by date range" title="Filter by date range">
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Range</option>
              <option value="all">All Time</option>
            </select>
            {filterRange === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input 
                  aria-label="Start Date" 
                  type="date" 
                  className="form-input" 
                  style={{ width: 'auto', padding: '4px 8px', fontSize: 11, height: '30px' }} 
                  value={filterStartDate} 
                  onChange={e => setFilterStartDate(e.target.value)} 
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>to</span>
                <input 
                  aria-label="End Date" 
                  type="date" 
                  className="form-input" 
                  style={{ width: 'auto', padding: '4px 8px', fontSize: 11, height: '30px' }} 
                  value={filterEndDate} 
                  onChange={e => setFilterEndDate(e.target.value)} 
                />
              </div>
            )}
            {isPrivileged && (
              <select className="form-select" style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}
                value={filterMember} onChange={e => setFilterMember(e.target.value)}
                aria-label="Filter by team member" title="Filter by team member">
                <option value="all">All Members</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            )}
            <select className="form-select" style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}
              value={filterProject} onChange={e => setFilterProject(e.target.value)}
              aria-label="Filter by project" title="Filter by project">
              <option value="all">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Task</th>
                <th>Duration</th>
                <th>Type</th>
                <th>Description</th>
                {isPrivileged && <th>Member</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, idx) => (
                <motion.tr key={e.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.3 }}>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(e.logged_date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td>
                    {(e.task as any)?.title
                      ? <span style={{ fontWeight: 600, fontSize: 13 }}>{(e.task as any).title}</span>
                      : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>No task</span>}
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: 'rgba(99,102,241,0.15)', color: '#6366f1', fontWeight: 700, fontSize: 12 }}>
                      ⏱ {fmtDuration(e.duration_minutes)}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: e.is_billable ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.12)',
                      color: e.is_billable ? '#22c55e' : '#94a3b8',
                      border: `1px solid ${e.is_billable ? 'rgba(34,197,94,0.3)' : 'rgba(148,163,184,0.3)'}`,
                    }}>
                      {e.is_billable ? '💰 Billable' : '🚫 Non-bill.'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 180 }}>
                    {e.description || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  {isPrivileged && (
                    <td style={{ fontSize: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="user-avatar" style={{ width: 22, height: 22, fontSize: 9 }}>
                          {(e.user as any)?.full_name?.[0] || '?'}
                        </div>
                        {(e.user as any)?.full_name || '—'}
                      </div>
                    </td>
                  )}
                  <td>
                    {(() => {
                      const isOld = daysAgo(e.logged_date) > 7;
                      const canManage = isPrivileged || (e.user_id === user?.id && !isOld);
                      
                      if (canManage) {
                        return (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(e)} title="Edit entry">✏️</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => removeEntry(e)} title="Delete entry">🗑️</button>
                          </div>
                        );
                      } else if (e.user_id === user?.id && isOld) {
                        return (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }} title="Locked: Older than 7 days. Contact a manager/admin.">
                            🔒 Locked
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </td>
                </motion.tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={isPrivileged ? 7 : 6} className="table-empty-state">
                    No time entries found. Start the timer or log time manually.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {filtered.length > 0 && (
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{filtered.length} entries</span>
                <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>💰 {fmtDuration(billableMins)}</span>
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>🚫 {fmtDuration(nonBillableMins)}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#6366f1' }}>Total: {fmtDuration(totalMins)}</span>
            </div>
          )}
        </motion.div>

        {/* Top Tasks Sidebar */}
        <motion.div className="glass-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }} style={{ padding: '20px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>⏰ Top Tasks by Time</h3>
          {taskSummary.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>No data yet</div>
          ) : (
            taskSummary.map((t, i) => {
              const pct = totalMins > 0 ? Math.round((t.totalMins / totalMins) * 100) : 0;
              const colors = ['#6366f1', '#06b6d4', '#22c55e', '#f59e0b', '#a855f7'];
              const color = colors[i % colors.length];
              return (
                <div key={t.taskId || 'unlinked'} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{t.taskTitle}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color, whiteSpace: 'nowrap', marginLeft: 8 }}>{fmtDuration(t.totalMins)}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{t.entries} {t.entries === 1 ? 'entry' : 'entries'} · {pct}%</div>
                </div>
              );
            })
          )}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16 }}>
            <button className="btn btn-secondary" style={{ width: '100%', fontSize: 12 }} onClick={() => openCreate()}>＋ Log Time Manually</button>
          </div>
        </motion.div>
      </div>

      {/* Log Time Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div className="modal-overlay" onClick={closeModal}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="modal" onClick={e => e.stopPropagation()}
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              style={{ maxWidth: 530 }}>

              <div className="modal-header">
                <h2>{editEntry ? '✏️ Edit Time Entry' : '⏱ Log Time'}</h2>
                <button className="btn-ghost" onClick={closeModal}>✕</button>
              </div>

              <div className="modal-body">

                {/* ── Task (role-filtered) ── */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Task (optional)</span>
                    {!isPrivileged && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>🔒 Your assigned tasks only</span>}
                  </label>
                  <select className="form-select" value={formTaskId} onChange={e => setFormTaskId(e.target.value)}
                    aria-label="Select task (optional)" title="Select task (optional)">
                    <option value="">No task</option>
                    {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                </div>

                {/* ── Billable Toggle ── */}
                <div className="form-group">
                  <label className="form-label">Billing Type *</label>
                  <BillableToggle value={formBillable} onChange={setFormBillable} />
                </div>

                {/* ── Date ── */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Date *</span>
                    {!isPrivileged && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>🔒 Max 7 days back</span>}
                  </label>
                  <input className="form-input" type="date" value={formDate}
                    min={minAllowedDate} max={todayISO()}
                    onChange={e => setFormDate(e.target.value)}
                    style={{ borderColor: dateError ? '#ef4444' : undefined }}
                    aria-label="Log date"
                    title="Log date"
                    placeholder={todayISO()} />
                  {dateError && (
                    <div style={{ marginTop: 6, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 12, color: '#ef4444' }}>
                      ⚠️ {dateError}
                    </div>
                  )}
                  {/* Date chips */}
                  <div style={{ marginTop: 6, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {(isPrivileged
                      ? [{ l: 'Today', d: dateNDaysAgo(0) }, { l: 'Yesterday', d: dateNDaysAgo(1) }, { l: '-3d', d: dateNDaysAgo(3) }, { l: '-7d', d: dateNDaysAgo(7) }, { l: '-14d', d: dateNDaysAgo(14) }, { l: '-30d', d: dateNDaysAgo(30) }]
                      : Array.from({ length: 7 }, (_, i) => ({ l: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : `-${i}d`, d: dateNDaysAgo(i) }))
                    ).map(({ l, d }) => (
                      <button key={d} type="button" onClick={() => setFormDate(d)} style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        border: `1px solid ${formDate === d ? '#6366f1' : 'var(--border)'}`,
                        background: formDate === d ? 'rgba(99,102,241,0.18)' : 'var(--bg-card)',
                        color: formDate === d ? '#6366f1' : 'var(--text-muted)', transition: 'all 0.15s',
                      }}>{l}</button>
                    ))}
                  </div>
                </div>

                {/* ── Duration ── */}
                <div className="form-group">
                  <label className="form-label">
                    <span>Duration *</span>
                  </label>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase' }}>FROM</div>
                        <input className="form-input" type="time" value={formFromTime} onChange={e => setFormFromTime(e.target.value)}
                          style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, textAlign: 'center' }}
                          aria-label="Start time" title="Start time" placeholder="09:00" />
                      </div>
                      <div style={{ fontSize: 22, color: 'var(--text-muted)', paddingTop: 20, fontWeight: 300 }}>→</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase' }}>TO</div>
                        <input className="form-input" type="time" value={formToTime} onChange={e => setFormToTime(e.target.value)}
                          style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, textAlign: 'center', borderColor: formToTime && computedRangeMins !== null && computedRangeMins <= 0 ? '#ef4444' : undefined }}
                          aria-label="End time" title="End time" placeholder="10:00" />
                      </div>
                    </div>
                    <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: computedRangeMins && computedRangeMins > 0 ? 'rgba(99,102,241,0.12)' : 'var(--bg-card)', border: `1px solid ${computedRangeMins && computedRangeMins > 0 ? 'rgba(99,102,241,0.3)' : 'var(--border)'}`, transition: 'all 0.2s' }}>
                      {computedRangeMins && computedRangeMins > 0 ? (
                        <div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: '#6366f1' }}>{fmtDuration(computedRangeMins)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formFromTime} → {formToTime} · {computedRangeMins} minutes</div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          {!formToTime ? 'Set an end time to calculate duration' : 'End time must be after start time'}
                        </div>
                      )}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', alignSelf: 'center', fontWeight: 600 }}>Quick:</span>
                      {[{ l: '30m', m: 30 }, { l: '1h', m: 60 }, { l: '1.5h', m: 90 }, { l: '2h', m: 120 }, { l: '4h', m: 240 }, { l: '8h', m: 480 }].map(({ l, m }) => (
                        <button key={l} type="button" onClick={() => { const f = timeToMins(formFromTime) ?? 540; setFormFromTime(minsToTime(f)); setFormToTime(minsToTime(f + m)); }}
                          style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', transition: 'all 0.15s' }}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Description ── */}
                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <textarea className="form-textarea" value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="What did you work on?" rows={3} />
                </div>

              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button className="btn btn-primary" onClick={saveEntry}
                  disabled={!!dateError || totalFormMins <= 0}
                  style={{ opacity: (!!dateError || totalFormMins <= 0) ? 0.6 : 1 }}>
                  {editEntry ? 'Update Entry' : 'Log Time'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

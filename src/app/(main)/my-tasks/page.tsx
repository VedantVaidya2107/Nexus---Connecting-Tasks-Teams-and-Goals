'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG } from '@/lib/types';
import type { Task, Profile } from '@/lib/types';

export default function MyTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('tasks')
      .select('*, project:projects(*)')
      .eq('assignee_id', user.id)
      .order('due_date', { ascending: true, nullsFirst: false });
    if (data) setTasks(data as Task[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const grouped = {
    today: tasks.filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      return new Date(t.due_date).toDateString() === new Date().toDateString();
    }),
    overdue: tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done' && new Date(t.due_date).toDateString() !== new Date().toDateString()),
    upcoming: tasks.filter(t => {
      if (!t.due_date || t.status === 'done') return false;
      const d = new Date(t.due_date);
      return d > new Date() && d.toDateString() !== new Date().toDateString();
    }),
    completed: tasks.filter(t => t.status === 'done'),
    noDueDate: tasks.filter(t => !t.due_date && t.status !== 'done'),
  };

  const toggleComplete = async (t: Task) => {
    const newStatus = t.status === 'done' ? 'pending' : 'done';
    await supabase.from('tasks').update({ status: newStatus, progress_percentage: newStatus === 'done' ? 100 : 0 }).eq('id', t.id);
    fetch();
  };

  const TaskRow = ({ t }: { t: Task }) => (
    <div className="glass-card" style={{ padding: '14px 18px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <button
        onClick={() => toggleComplete(t)}
        style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${t.status === 'done' ? 'var(--green)' : 'var(--border)'}`,
          background: t.status === 'done' ? 'var(--green)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', color: 'white',
        }}
      >{t.status === 'done' ? '✓' : ''}</button>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '14px', textDecoration: t.status === 'done' ? 'line-through' : 'none', opacity: t.status === 'done' ? 0.5 : 1 }}>{t.title}</div>
        {t.project && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>📁 {(t.project as unknown as { name: string }).name}</div>}
      </div>
      <span className="badge" style={{ background: TASK_PRIORITY_CONFIG[t.priority].bg, color: TASK_PRIORITY_CONFIG[t.priority].color, fontSize: '11px' }}>
        {TASK_PRIORITY_CONFIG[t.priority].icon}
      </span>
      <span className="badge" style={{ background: TASK_STATUS_CONFIG[t.status].bg, color: TASK_STATUS_CONFIG[t.status].color, fontSize: '11px' }}>
        {TASK_STATUS_CONFIG[t.status].label}
      </span>
      {t.due_date && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(t.due_date).toLocaleDateString()}</span>}
    </div>
  );

  const Section = ({ title, items, color }: { title: string; items: Task[]; color: string }) => {
    if (items.length === 0) return null;
    return (
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
          {title} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({items.length})</span>
        </h3>
        {items.map(t => <TaskRow key={t.id} t={t} />)}
      </div>
    );
  };

  if (loading) return <AppLayout><div className="loading-page"><div className="spinner" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="page-header">
        <div><h1>My Tasks</h1><div className="subtitle">{tasks.filter(t => t.status !== 'done').length} remaining</div></div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => window.location.href = '/tasks?create=true'}>＋ New Task</button>
        </div>
      </div>
      <Section title="Overdue" items={grouped.overdue} color="var(--red)" />
      <Section title="Due Today" items={grouped.today} color="var(--amber)" />
      <Section title="Upcoming" items={grouped.upcoming} color="var(--blue)" />
      <Section title="No Due Date" items={grouped.noDueDate} color="var(--text-muted)" />
      <Section title="Completed" items={grouped.completed} color="var(--green)" />
      {tasks.length === 0 && (
        <div className="empty-state"><div className="empty-icon">📝</div><h3>No tasks assigned</h3><p>Tasks assigned to you will appear here.</p></div>
      )}
    </AppLayout>
  );
}

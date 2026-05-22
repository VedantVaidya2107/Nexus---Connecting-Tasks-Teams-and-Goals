'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG } from '@/lib/types';
import type { Task, TaskStatus, TaskPriority, Profile, Project, TimeEntry } from '@/lib/types';
import toast from 'react-hot-toast';
import { createTask, updateTaskStatus, updateTask } from '@/actions/tasks';
import { createTimeEntry } from '@/actions/timeEntries';
import { motion, AnimatePresence } from 'framer-motion';

function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'awaiting_zoho', 'awaiting_client', 'awaiting_team', 'done', 'cancelled'];

export default function TasksPage() {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [modalTab, setModalTab] = useState<'details' | 'time'>('details');

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formStatus, setFormStatus] = useState<TaskStatus>('pending');
  const [formPriority, setFormPriority] = useState<TaskPriority>('medium');
  const [formAssignee, setFormAssignee] = useState('');
  const [formProject, setFormProject] = useState('');
  const [formDueDate, setFormDueDate] = useState('');

  // Time entry state
  const [taskTimeEntries, setTaskTimeEntries] = useState<TimeEntry[]>([]);
  const [timeHours, setTimeHours] = useState('');
  const [timeMins, setTimeMins] = useState('');
  const [timeDesc, setTimeDesc] = useState('');
  const [timeDate, setTimeDate] = useState(new Date().toISOString().split('T')[0]);
  const [logginTime, setLogginTime] = useState(false);
  const [timeDurationMode, setTimeDurationMode] = useState<'range' | 'manual'>('range');
  const [timeFromTime, setTimeFromTime] = useState('09:00');
  const [timeToTime, setTimeToTime] = useState('');
  const [timeBillable, setTimeBillable] = useState(true);

  // Helpers
  const isPrivileged = profile?.role === 'admin' || profile?.role === 'manager';
  const todayStr = new Date().toISOString().split('T')[0];
  const dateNDaysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; };
  const timeToMinsUtil = (t: string): number | null => {
    const match = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const h = parseInt(match[1]); const m = parseInt(match[2]);
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
  };
  const minsToTimeUtil = (m: number) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
  const computedRangeMinsTask = (() => {
    if (timeDurationMode !== 'range') return null;
    const from = timeToMinsUtil(timeFromTime);
    const to = timeToMinsUtil(timeToTime);
    if (from === null || to === null || to <= from) return null;
    return to - from;
  })();
  const totalTimeMins = timeDurationMode === 'range'
    ? (computedRangeMinsTask ?? 0)
    : ((parseInt(timeHours) || 0) * 60 + (parseInt(timeMins) || 0));
  const timeDateDaysAgo = (() => { const now = new Date(); now.setHours(0,0,0,0); const d = new Date(timeDate); d.setHours(0,0,0,0); return Math.round((now.getTime()-d.getTime())/(86400000)); })();
  const timeDateRestricted = !isPrivileged && timeDateDaysAgo > 7;

  const fetchAll = useCallback(async () => {
    const [tRes, pRes, prRes] = await Promise.all([
      supabase.from('tasks').select('*, assignee:profiles!tasks_assignee_id_fkey(*)').order('sort_order'),
      supabase.from('profiles').select('*').eq('is_active', true),
      supabase.from('projects').select('*').eq('status', 'active'),
    ]);
    if (tRes.data) {
      let fetchedTasks = tRes.data as Task[];
      if (profile?.role === 'team_member') {
        // Hide tasks explicitly assigned to other people
        fetchedTasks = fetchedTasks.filter(t => t.assignee_id === user?.id);
      }
      setTasks(fetchedTasks);
    }
    if (pRes.data) setProfiles(pRes.data as Profile[]);
    if (prRes.data) setProjects(prRes.data as unknown as Project[]);
    setLoading(false);
  }, [profile?.role, user?.id]);

  useEffect(() => { 
    fetchAll(); 
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') === 'true') {
      const pId = params.get('projectId');
      openCreate(pId || undefined);
    }
    const status = params.get('status');
    if (status && STATUSES.includes(status as TaskStatus)) setFilterStatus(status);
    
    const priority = params.get('priority');
    if (priority && ['high', 'medium', 'low'].includes(priority)) setFilterPriority(priority);

    const filter = params.get('filter');
    if (filter === 'overdue') setFilterOverdue(true);

    // Clean up URL if it's just 'create=true'
    if (params.get('create') === 'true') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchAll]);

  const openCreate = (pId?: string) => {
    setEditTask(null);
    setFormTitle(''); setFormDesc(''); setFormStatus('pending');
    setFormPriority('medium'); 
    setFormAssignee((user && profiles.some(p => p.id === user.id && p.role === 'team_member')) ? user.id : ''); 
    setFormProject(pId || ''); setFormDueDate('');
    setShowModal(true);
  };

  const openEdit = async (t: Task) => {
    setEditTask(t);
    setFormTitle(t.title); setFormDesc(t.description || '');
    setFormStatus(t.status); setFormPriority(t.priority);
    setFormAssignee(t.assignee_id || ''); setFormProject(t.project_id || '');
    setFormDueDate(t.due_date || '');
    setModalTab('details');
    setTimeHours(''); setTimeMins(''); setTimeDesc('');
    setTimeDate(new Date().toISOString().split('T')[0]);
    setTimeDurationMode('range'); setTimeFromTime('09:00'); setTimeToTime(''); setTimeBillable(true);
    // Fetch time entries for this task
    const { data } = await supabase
      .from('time_entries')
      .select('*, user:profiles(full_name)')
      .eq('task_id', t.id)
      .order('logged_date', { ascending: false });
    setTaskTimeEntries((data as TimeEntry[]) || []);
    setShowModal(true);
  };

  const logTimeOnTask = async () => {
    if (!editTask) return;
    if (timeDateRestricted) { toast.error('Team members can only log time within the past 7 days'); return; }
    if (timeDateDaysAgo < 0) { toast.error('Cannot log time for a future date'); return; }
    if (timeDurationMode === 'range') {
      const from = timeToMinsUtil(timeFromTime);
      const to = timeToMinsUtil(timeToTime);
      if (from === null) { toast.error('Invalid start time'); return; }
      if (to === null) { toast.error('Invalid end time'); return; }
      if (to <= from) { toast.error('End time must be after start time'); return; }
    }
    if (totalTimeMins <= 0) { toast.error('Duration must be at least 1 minute'); return; }
    setLogginTime(true);
    const res = await createTimeEntry(
      { task_id: editTask.id, duration_minutes: totalTimeMins, description: timeDesc.trim() || null, logged_date: timeDate, is_billable: timeBillable },
      user?.id || ''
    );
    setLogginTime(false);
    if (!res.success) { toast.error(res.message || 'Error'); return; }
    toast.success('Time logged');
    setTimeHours(''); setTimeMins(''); setTimeDesc(''); setTimeFromTime('09:00'); setTimeToTime('');
    // Refresh entries
    const { data } = await supabase
      .from('time_entries')
      .select('*, user:profiles(full_name)')
      .eq('task_id', editTask.id)
      .order('logged_date', { ascending: false });
    setTaskTimeEntries((data as TimeEntry[]) || []);
    fetchAll();
  };

  const saveTask = async () => {
    if (!formTitle.trim()) { toast.error('Title is required'); return; }

    // Only validate past due date if creating a new task, or if explicitly changing it on an existing task
    const isNewPastDate = editTask 
      ? formDueDate && formDueDate !== editTask.due_date && new Date(formDueDate) < new Date(new Date().setHours(0,0,0,0))
      : formDueDate && new Date(formDueDate) < new Date(new Date().setHours(0,0,0,0));

    if (isNewPastDate) {
      toast.error('Due date cannot be in the past'); return;
    }

    const payload = {
      title: formTitle.trim(),
      description: formDesc.trim() || null,
      status: formStatus,
      priority: formPriority,
      assignee_id: formAssignee || null,
      project_id: formProject || null,
      due_date: formDueDate || null,
    };

    if (editTask) {
      const res = await updateTask(editTask.id, payload, user?.id || '');
      if (!res.success) { toast.error(res.message || 'Error'); return; }
      toast.success('Task updated');
    } else {
      const res = await createTask(payload, user?.id || '');
      if (!res.success) { toast.error(res.message || 'Error'); return; }
      toast.success('Task created');
    }

    setShowModal(false);
    fetchAll();
  };

  const deleteTask = async (id: string) => {
    if (profile?.role === 'team_member') {
      toast.error('Team members cannot delete tasks.');
      return;
    }
    if (!confirm('Delete this task?')) return;
    await supabase.from('tasks').delete().eq('id', id);
    toast.success('Task deleted');
    fetchAll();
  };

  const moveTask = async (taskId: string, newStatus: TaskStatus) => {
    const res = await updateTaskStatus(taskId, newStatus, user?.id || '');
    if (!res.success) { toast.error(res.message || 'Error'); return; }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  };

  const filtered = tasks.filter(t => {
    if (filterStatus !== 'all') {
      if (filterStatus === 'awaiting') {
        if (!['awaiting_zoho', 'awaiting_client', 'awaiting_team'].includes(t.status)) return false;
      } else if (t.status !== filterStatus) {
        return false;
      }
    }
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (filterUser !== 'all' && t.assignee_id !== filterUser) return false;
    if (filterOverdue) {
      const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done';
      if (!isOverdue) return false;
    }
    return true;
  });

  if (loading) return <AppLayout><div className="loading-page"><div className="spinner" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="page-header">
        <div><h1>All Tasks</h1><div className="subtitle">{tasks.length} tasks total</div></div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => openCreate()}>＋ New Task</button>
        </div>
      </div>

      {/* Compact Status KPI Strip - only in List view (Kanban columns already show this) */}
      {view === 'list' && (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
        {STATUSES.map(s => {
          const count = tasks.filter(t => t.status === s).length;
          const cfg = TASK_STATUS_CONFIG[s];
          return (
            <div
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 14px', borderRadius: '10px',
                background: filterStatus === s ? cfg.color + '25' : 'var(--bg-glass)',
                border: `1px solid ${filterStatus === s ? cfg.color + '60' : 'var(--border)'}`,
                cursor: 'pointer', transition: 'all 0.15s ease',
                fontSize: '13px', fontWeight: 500,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
              <span style={{ color: 'var(--text-secondary)' }}>{cfg.label}</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{count}</span>
            </div>
          );
        })}
      </div>
      )}

      {/* Controls Row: Tabs + Filters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          <button className={`tab-item ${view === 'kanban' ? 'active' : ''}`} onClick={() => setView('kanban')}>Kanban</button>
          <button className={`tab-item ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>List</button>
        </div>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          <select aria-label="Filter by Priority" className="form-select" style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="all">All Priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select aria-label="Filter by User" className="form-select" style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }} value={filterUser} onChange={e => setFilterUser(e.target.value)}>
            <option value="all">All Users</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
      </div>

      {view === 'kanban' && (
        <div className="kanban-board">
          {STATUSES.map((status, colIndex) => {
            const colTasks = filtered.filter(t => t.status === status);
            const cfg = TASK_STATUS_CONFIG[status];
            return (
              <motion.div
                key={status}
                className="kanban-column"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: colIndex * 0.1, duration: 0.4 }}
                onDragOver={e => e.preventDefault()}
                onDrop={() => { if (draggedTaskId) { moveTask(draggedTaskId, status); setDraggedTaskId(null); } }}
              >
                <div className="kanban-column-header">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
                    {cfg.label}
                  </span>
                  <span className="count">{colTasks.length}</span>
                </div>
                <div className="kanban-column-body">
                  {colTasks.map((t, tIndex) => (
                    <motion.div
                      key={t.id}
                      className="glass-card task-card"
                      draggable
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: (colIndex * 0.1) + (tIndex * 0.05), duration: 0.3 }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onDragStart={() => setDraggedTaskId(t.id)}
                      onClick={() => openEdit(t)}
                    >
                      <div className="task-title">{t.title}</div>
                      <div className="task-meta">
                        <span className="tag" style={{ background: TASK_PRIORITY_CONFIG[t.priority].bg, color: TASK_PRIORITY_CONFIG[t.priority].color }}>
                          {TASK_PRIORITY_CONFIG[t.priority].icon} {TASK_PRIORITY_CONFIG[t.priority].label}
                        </span>
                        {t.due_date && (
                          <span style={{ fontSize: '11px', color: new Date(t.due_date) < new Date() ? 'var(--red)' : 'var(--text-muted)' }}>
                            📅 {new Date(t.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {(t.assignee as any)?.full_name && (
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
                          <div className="user-avatar" style={{ width: 20, height: 20, fontSize: 9 }}>
                            {(t.assignee as any).full_name[0]}
                          </div>
                          {(t.assignee as any).full_name}
                        </div>
                      )}
                    </motion.div>
                  ))}
                  {colTasks.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>No tasks</div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {view === 'list' && (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr><th>Task</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map((t, idx) => (
                <motion.tr 
                  key={t.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.3 }}
                >
                  <td style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => openEdit(t)}>{t.title}</td>
                  <td>
                    <span className="badge" style={{ background: TASK_STATUS_CONFIG[t.status].bg, color: TASK_STATUS_CONFIG[t.status].color }}>
                      {TASK_STATUS_CONFIG[t.status].label}
                    </span>
                  </td>
                  <td>
                    <span className="badge" style={{ background: TASK_PRIORITY_CONFIG[t.priority].bg, color: TASK_PRIORITY_CONFIG[t.priority].color }}>
                      {TASK_PRIORITY_CONFIG[t.priority].icon} {TASK_PRIORITY_CONFIG[t.priority].label}
                    </span>
                  </td>
                  <td>{(t.assignee as any)?.full_name || '—'}</td>
                  <td className={t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done' ? 'text-danger' : ''}>
                    {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}>✏️</button>
                    {profile?.role !== 'team_member' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => deleteTask(t.id)}>🗑️</button>
                    )}
                  </td>
                </motion.tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="table-empty-state">No tasks found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div 
            className="modal-overlay" 
            onClick={() => setShowModal(false)}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div 
              className="modal" 
              onClick={e => e.stopPropagation()}
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
            >
              <div className="modal-header">
              <h2>{editTask ? 'Edit Task' : 'Create Task'}</h2>
              <button className="btn-ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {/* Modal Tabs — only show when editing an existing task */}
            {editTask && (
              <div className="tab-bar" style={{ margin: '0 24px', borderBottom: '1px solid var(--border)', borderRadius: 0, padding: '0 0 0 0' }}>
                <button className={`tab-item ${modalTab === 'details' ? 'active' : ''}`} onClick={() => setModalTab('details')}>📋 Details</button>
                <button className={`tab-item ${modalTab === 'time' ? 'active' : ''}`} onClick={() => setModalTab('time')}>
                  ⏱ Time {taskTimeEntries.length > 0 && <span style={{ marginLeft: 4, background: '#6366f1', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{taskTimeEntries.length}</span>}
                </button>
              </div>
            )}

            {/* Details Tab */}
            {modalTab === 'details' && (
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="taskTitle" className="form-label">Title *</label>
                <input id="taskTitle" className="form-input" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Task title" />
              </div>
              <div className="form-group">
                <label htmlFor="taskDesc" className="form-label">Description</label>
                <textarea id="taskDesc" className="form-textarea" value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Describe the task..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label htmlFor="taskStatus" className="form-label">Status</label>
                  <select id="taskStatus" className="form-select" value={formStatus} onChange={e => setFormStatus(e.target.value as TaskStatus)}>
                    {STATUSES.map(s => <option key={s} value={s}>{TASK_STATUS_CONFIG[s].label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="taskPriority" className="form-label">Priority</label>
                  <select id="taskPriority" className="form-select" value={formPriority} onChange={e => setFormPriority(e.target.value as TaskPriority)}>
                    {(['high', 'medium', 'low'] as const).map(p => <option key={p} value={p}>{TASK_PRIORITY_CONFIG[p].label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="taskAssignee" className="form-label">Assignee</label>
                  <select 
                    id="taskAssignee"
                    className="form-select" 
                    value={formAssignee} 
                    onChange={e => setFormAssignee(e.target.value)}
                    disabled={profiles.find(p => p.id === user?.id)?.role === 'team_member'}
                  >
                    <option value="">Unassigned</option>
                    {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="taskProject" className="form-label">Project</label>
                  <select id="taskProject" className="form-select" value={formProject} onChange={e => setFormProject(e.target.value)}>
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="taskDueDate" className="form-label">Due Date</label>
                  <input id="taskDueDate" className="form-input" type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} />
                </div>
              </div>
            </div>
            )}

            {/* Time Tab */}
            {modalTab === 'time' && editTask && (
            <div className="modal-body">
              {/* Quick Log Form */}
              <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '16px', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1' }}>⏱ Quick Log</div>
                  <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', fontSize: 10 }}>
                    <button type="button" onClick={() => setTimeDurationMode('range')} style={{ padding: '3px 10px', fontWeight: 700, cursor: 'pointer', border: 'none', background: timeDurationMode === 'range' ? '#6366f1' : 'transparent', color: timeDurationMode === 'range' ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s' }}>⏰ From–To</button>
                    <button type="button" onClick={() => setTimeDurationMode('manual')} style={{ padding: '3px 10px', fontWeight: 700, cursor: 'pointer', border: 'none', background: timeDurationMode === 'manual' ? '#6366f1' : 'transparent', color: timeDurationMode === 'manual' ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s' }}>🔢 Manual</button>
                  </div>
                </div>

                {/* From–To mode */}
                {timeDurationMode === 'range' && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase' }}>FROM</div>
                        <input className="form-input" type="time" value={timeFromTime} onChange={e => setTimeFromTime(e.target.value)} style={{ fontFamily: 'monospace', fontWeight: 700, textAlign: 'center' }} />
                      </div>
                      <span style={{ fontSize: 18, color: 'var(--text-muted)', paddingTop: 16 }}>→</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 3, textTransform: 'uppercase' }}>TO</div>
                        <input className="form-input" type="time" value={timeToTime} onChange={e => setTimeToTime(e.target.value)} style={{ fontFamily: 'monospace', fontWeight: 700, textAlign: 'center' }} />
                      </div>
                    </div>
                    {computedRangeMinsTask && computedRangeMinsTask > 0 ? (
                      <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', fontSize: 12, color: '#6366f1', fontWeight: 700 }}>
                        ⏱ {fmtDuration(computedRangeMinsTask)} ({computedRangeMinsTask}min)
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 0' }}>Set end time to see duration</div>
                    )}
                    <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {[{l:'30m',m:30},{l:'1h',m:60},{l:'2h',m:120},{l:'4h',m:240}].map(({l,m}) => (
                        <button key={l} type="button" onClick={() => { const f = timeToMinsUtil(timeFromTime) ?? 9*60; setTimeFromTime(minsToTimeUtil(f)); setTimeToTime(minsToTimeUtil(f+m)); }}
                          style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700, cursor:'pointer', border:'1px solid var(--border)', background:'var(--bg-card)', color:'var(--text-muted)' }}>{l}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manual mode */}
                {timeDurationMode === 'manual' && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ position: 'relative' }}>
                        <input className="form-input" type="number" min="0" placeholder="0" value={timeHours} onChange={e => setTimeHours(e.target.value)} style={{ paddingRight: 28, fontWeight: 700, textAlign: 'center' }} />
                        <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-muted)' }}>h</span>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <input className="form-input" type="number" min="0" max="59" placeholder="0" value={timeMins} onChange={e => setTimeMins(e.target.value)} style={{ paddingRight: 28, fontWeight: 700, textAlign: 'center' }} />
                        <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-muted)' }}>m</span>
                      </div>
                    </div>
                    {totalTimeMins > 0 && <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: '#6366f1' }}>= {fmtDuration(totalTimeMins)}</div>}
                  </div>
                )}

                <input className="form-input" placeholder="What did you work on? (optional)" value={timeDesc} onChange={e => setTimeDesc(e.target.value)} style={{ marginBottom: 10 }} />

                {/* Billing Type selection */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>Billing Type *</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setTimeBillable(true)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', transition: 'all 0.15s ease',
                        border: `2px solid ${timeBillable ? '#22c55e' : 'var(--border)'}`,
                        background: timeBillable ? 'rgba(34,197,94,0.12)' : 'transparent',
                        color: timeBillable ? '#22c55e' : 'var(--text-muted)',
                      }}
                    >
                      <span style={{ fontSize: 13 }}>💰</span> Billable
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeBillable(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', transition: 'all 0.15s ease',
                        border: `2px solid ${!timeBillable ? '#94a3b8' : 'var(--border)'}`,
                        background: !timeBillable ? 'rgba(148,163,184,0.12)' : 'transparent',
                        color: !timeBillable ? '#94a3b8' : 'var(--text-muted)',
                      }}
                    >
                      <span style={{ fontSize: 13 }}>🚫</span> Non-billable
                    </button>
                  </div>
                </div>

                {/* Date picker with restriction */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                  <input
                    className="form-input"
                    type="date"
                    value={timeDate}
                    min={!isPrivileged ? dateNDaysAgo(7) : undefined}
                    max={todayStr}
                    onChange={e => setTimeDate(e.target.value)}
                    style={{ flex: 1, borderColor: timeDateRestricted ? '#ef4444' : undefined }}
                  />
                  <button className="btn btn-primary" onClick={logTimeOnTask} disabled={logginTime || timeDateRestricted || totalTimeMins <= 0} style={{ whiteSpace: 'nowrap', opacity: (logginTime || timeDateRestricted || totalTimeMins <= 0) ? 0.6 : 1 }}>
                    {logginTime ? 'Logging…' : '+ Log Time'}
                  </button>
                </div>

                {/* Quick date chips */}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                  {(isPrivileged
                    ? [{l:'Today',d:dateNDaysAgo(0)},{l:'Yesterday',d:dateNDaysAgo(1)},{l:'-3d',d:dateNDaysAgo(3)},{l:'-7d',d:dateNDaysAgo(7)},{l:'-14d',d:dateNDaysAgo(14)}]
                    : Array.from({length:7},(_,i)=>({l:i===0?'Today':i===1?'Yesterday':`-${i}d`,d:dateNDaysAgo(i)}))
                  ).map(({l,d}) => (
                    <button key={d} type="button" onClick={() => setTimeDate(d)} style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:700, cursor:'pointer', border:`1px solid ${timeDate===d?'#6366f1':'var(--border)'}`, background:timeDate===d?'rgba(99,102,241,0.2)':'var(--bg-card)', color:timeDate===d?'#6366f1':'var(--text-muted)', transition:'all 0.15s' }}>{l}</button>
                  ))}
                </div>

                {timeDateRestricted && (
                  <div style={{ padding:'8px 10px', borderRadius:8, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', fontSize:11, color:'#ef4444' }}>
                    ⚠️ Team members can only log time within the past 7 days. Contact a manager or admin for older entries.
                  </div>
                )}
                {!isPrivileged && (
                  <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:4 }}>🔒 Restricted to past 7 days</div>
                )}

                {editTask.time_estimate_minutes && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 16 }}>
                    <span>📐 Estimate: <b style={{ color: 'var(--text-primary)' }}>{fmtDuration(editTask.time_estimate_minutes)}</b></span>
                    <span>⏱ Spent: <b style={{ color: '#6366f1' }}>{fmtDuration(editTask.time_spent_minutes || 0)}</b></span>
                  </div>
                )}
              </div>

              {/* Entries List */}
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>History ({taskTimeEntries.length})</div>
              {taskTimeEntries.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>No time logged yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                  {taskTimeEntries.map(te => (
                    <div key={te.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 80 }}>
                        {new Date(te.logged_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                      </span>
                      <span style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                        {fmtDuration(te.duration_minutes)}
                      </span>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '2px 6px',
                        borderRadius: 10,
                        fontSize: 10,
                        fontWeight: 700,
                        background: te.is_billable ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.12)',
                        color: te.is_billable ? '#22c55e' : '#94a3b8',
                        border: `1px solid ${te.is_billable ? 'rgba(34,197,94,0.2)' : 'rgba(148,163,184,0.2)'}`,
                      }}>
                        {te.is_billable ? '💰' : '🚫'}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{te.description || '—'}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(te.user as any)?.full_name || 'You'}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 12, textAlign: 'right' }}>
                <a href="/time-tracker" style={{ fontSize: 12, color: '#6366f1', textDecoration: 'none' }}>View all in Time Tracker →</a>
              </div>
            </div>
            )}

            <div className="modal-footer">
              {modalTab === 'details' && (
                <>
                  <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={saveTask}>{editTask ? 'Update' : 'Create'}</button>
                </>
              )}
              {modalTab === 'time' && (
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Close</button>
              )}
            </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

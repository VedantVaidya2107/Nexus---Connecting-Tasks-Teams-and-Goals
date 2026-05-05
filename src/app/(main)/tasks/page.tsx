'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG } from '@/lib/types';
import type { Task, TaskStatus, TaskPriority, Profile, Project } from '@/lib/types';
import toast from 'react-hot-toast';
import { createTask, updateTaskStatus, updateTask } from '@/actions/tasks';

const STATUSES: TaskStatus[] = ['pending', 'in_progress', 'awaiting_zoho', 'awaiting_client', 'awaiting_team', 'done', 'cancelled'];

export default function TasksPage() {
  const { user } = useAuth();
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

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formStatus, setFormStatus] = useState<TaskStatus>('pending');
  const [formPriority, setFormPriority] = useState<TaskPriority>('medium');
  const [formAssignee, setFormAssignee] = useState('');
  const [formProject, setFormProject] = useState('');
  const [formDueDate, setFormDueDate] = useState('');

  const fetchAll = useCallback(async () => {
    const [tRes, pRes, prRes] = await Promise.all([
      supabase.from('tasks').select('*, assignee:profiles!tasks_assignee_id_fkey(*)').order('sort_order'),
      supabase.from('profiles').select('*').eq('is_active', true),
      supabase.from('projects').select('*, project_members!inner(user_id)').eq('status', 'active'),
    ]);
    if (tRes.data) setTasks(tRes.data as Task[]);
    if (pRes.data) setProfiles(pRes.data as Profile[]);
    if (prRes.data) setProjects(prRes.data as unknown as Project[]);
    setLoading(false);
  }, []);

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

  const openEdit = (t: Task) => {
    setEditTask(t);
    setFormTitle(t.title); setFormDesc(t.description || '');
    setFormStatus(t.status); setFormPriority(t.priority);
    setFormAssignee(t.assignee_id || ''); setFormProject(t.project_id || '');
    setFormDueDate(t.due_date || '');
    setShowModal(true);
  };

  const saveTask = async () => {
    if (!formTitle.trim()) { toast.error('Title is required'); return; }
    if (formDueDate && new Date(formDueDate) < new Date(new Date().setHours(0,0,0,0))) {
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
          <select className="form-select" style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="all">All Priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select className="form-select" style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }} value={filterUser} onChange={e => setFilterUser(e.target.value)}>
            <option value="all">All Users</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
      </div>

      {view === 'kanban' && (
        <div className="kanban-board">
          {STATUSES.map(status => {
            const colTasks = filtered.filter(t => t.status === status);
            const cfg = TASK_STATUS_CONFIG[status];
            return (
              <div
                key={status}
                className="kanban-column"
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
                  {colTasks.map(t => (
                    <div
                      key={t.id}
                      className="glass-card task-card"
                      draggable
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
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>No tasks</div>
                  )}
                </div>
              </div>
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
              {filtered.map(t => (
                <tr key={t.id}>
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
                  <td style={{ color: t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed' ? 'var(--red)' : 'inherit' }}>
                    {t.due_date ? new Date(t.due_date).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}>✏️</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => deleteTask(t.id)}>🗑️</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>No tasks found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editTask ? 'Edit Task' : 'Create Task'}</h2>
              <button className="btn-ghost" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-input" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Task title" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Describe the task..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={formStatus} onChange={e => setFormStatus(e.target.value as TaskStatus)}>
                    {STATUSES.map(s => <option key={s} value={s}>{TASK_STATUS_CONFIG[s].label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-select" value={formPriority} onChange={e => setFormPriority(e.target.value as TaskPriority)}>
                    {(['high', 'medium', 'low'] as const).map(p => <option key={p} value={p}>{TASK_PRIORITY_CONFIG[p].label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Assignee</label>
                  <select 
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
                  <label className="form-label">Project</label>
                  <select className="form-select" value={formProject} onChange={e => setFormProject(e.target.value)}>
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input className="form-input" type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveTask}>{editTask ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

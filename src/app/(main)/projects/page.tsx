'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PROJECT_STATUS_CONFIG } from '@/lib/types';
import type { Project, Task } from '@/lib/types';
import toast from 'react-hot-toast';

export default function ProjectsPage() {
  const { user, profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  
  // Form State
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [teamIds, setTeamIds] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    const [pRes, tRes, uRes] = await Promise.all([
      supabase.from('projects').select('*, owner:profiles(*)').order('created_at', { ascending: false }),
      supabase.from('tasks').select('id, project_id, status'),
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
    ]);
    if (pRes.data) setProjects(pRes.data as Project[]);
    if (tRes.data) setTasks(tRes.data as Task[]);
    if (uRes.data) setAllUsers(uRes.data as Profile[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveProject = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    
    const projectData = {
      name: name.trim(),
      description: desc.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
      color,
      team_ids: teamIds,
      owner_id: editingProject ? editingProject.owner_id : user?.id,
    };

    if (editingProject) {
      const { error } = await supabase.from('projects').update(projectData).eq('id', editingProject.id);
      if (error) { toast.error(error.message); return; }
      toast.success('Project updated');
    } else {
      const { error } = await supabase.from('projects').insert(projectData);
      if (error) { toast.error(error.message); return; }
      toast.success('Project created');
    }

    setShowModal(false);
    resetForm();
    fetchData();
  };

  const resetForm = () => {
    setEditingProject(null);
    setName('');
    setDesc('');
    setStartDate('');
    setEndDate('');
    setColor('#6366f1');
    setTeamIds([]);
  };

  const editProject = (p: Project) => {
    setEditingProject(p);
    setName(p.name);
    setDesc(p.description || '');
    setStartDate(p.start_date || '');
    setEndDate(p.end_date || '');
    setColor(p.color);
    setTeamIds(p.team_ids || []);
    setShowModal(true);
  };

  const canCreate = profile?.role === 'admin' || profile?.role === 'manager';

  if (loading) return <AppLayout><div className="loading-page"><div className="spinner" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="page-header">
        <div><h1>Projects</h1><div className="subtitle">{projects.length} projects</div></div>
        {canCreate && <button className="btn btn-primary" onClick={() => setShowModal(true)}>＋ New Project</button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
        {projects.map(p => {
          const pTasks = tasks.filter(t => t.project_id === p.id);
          const completed = pTasks.filter(t => t.status === 'done').length;
          const progress = pTasks.length > 0 ? Math.round((completed / pTasks.length) * 100) : 0;
          const cfg = PROJECT_STATUS_CONFIG[p.status];
          return (
            <div key={p.id} className="glass-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: p.color }} />
              <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{p.name}</h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Owned by {p.owner?.full_name || 'System'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {canCreate && <button className="btn-ghost btn-sm" onClick={() => editProject(p)} style={{ padding: '4px' }}>✏️</button>}
                  <span className="badge" style={{ background: cfg.color + '20', color: cfg.color }}>{cfg.label}</span>
                </div>
              </div>
              {p.description && <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>{p.description}</p>}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Progress</span>
                  <span style={{ fontWeight: 600 }}>{progress}%</span>
                </div>
                <div className="progress-bar"><div className="fill" style={{ width: `${progress}%` }} /></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span>📋 {pTasks.length} tasks</span>
                <span>✅ {completed} done</span>
                <button 
                  className="btn-ghost btn-sm" 
                  style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--bg-hover)' }}
                  onClick={() => window.location.href = `/tasks?create=true&projectId=${p.id}`}
                >
                  ➕ Add Task
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {projects.length === 0 && (
        <div className="empty-state"><div className="empty-icon">📁</div><h3>No projects yet</h3><p>Create your first project to get started.</p></div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingProject ? 'Edit Project' : 'New Project'}</h2>
              <button className="btn-ghost" onClick={() => { setShowModal(false); resetForm(); }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Project name" /></div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Describe the project..." /></div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">End Date</label><input className="form-input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Color</label><input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: '100%', height: '42px', border: 'none', borderRadius: '8px', cursor: 'pointer' }} /></div>
              </div>

              <div className="form-group">
                <label className="form-label">Project Team</label>
                <div style={{ maxHeight: '150px', overflowY: 'auto', background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  {allUsers.map(u => (
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', cursor: 'pointer', fontSize: '13px' }}>
                      <input 
                        type="checkbox" 
                        checked={teamIds.includes(u.id)}
                        onChange={(e) => {
                          if (e.target.checked) setTeamIds([...teamIds, u.id]);
                          else setTeamIds(teamIds.filter(id => id !== u.id));
                        }}
                      />
                      <span>{u.full_name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({u.job_title || u.role})</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</button>
              <button className="btn btn-primary" onClick={saveProject}>
                {editingProject ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

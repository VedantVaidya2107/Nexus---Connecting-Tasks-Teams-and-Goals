'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { PROJECT_STATUS_CONFIG } from '@/lib/types';
import type { Project, Task, Profile } from '@/lib/types';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

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
    console.log('Fetching projects for user:', user?.id, 'Role:', profile?.role);
    
    let pQuery = supabase.from('projects').select('*, owner:profiles(*)').order('created_at', { ascending: false });
    
    // Privacy: Members only see projects they belong to
    if (profile?.role === 'team_member') {
      const { data: memberProjects } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user?.id);
      
      const projectIds = memberProjects?.map(mp => mp.project_id) || [];
      if (projectIds.length === 0) {
        setProjects([]);
        setLoading(false);
        return;
      }
      pQuery = pQuery.in('id', projectIds);
    }

    const [pRes, tRes, uRes, mRes] = await Promise.all([
      pQuery,
      supabase.from('tasks').select('id, project_id, status'),
      supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
      supabase.from('project_members').select('*')
    ]);

    if (pRes.error) {
      console.error('Projects Fetch Error:', pRes.error);
      toast.error('Failed to fetch projects');
    } else {
      // Map members into projects for easier access
      const allMembers = mRes.data || [];
      const projectsWithMembers = (pRes.data || []).map(p => ({
        ...p,
        team_ids: allMembers.filter(m => m.project_id === p.id).map(m => m.user_id)
      }));
      setProjects(projectsWithMembers as Project[]);
    }

    if (tRes.error) console.error('Tasks Fetch Error:', tRes.error);
    else setTasks(tRes.data as Task[]);

    if (uRes.error) console.error('Profiles Fetch Error:', uRes.error);
    else setAllUsers(uRes.data as Profile[]);

    setLoading(false);
  }, [profile, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveProject = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    
    const projectData = {
      name: name.trim(),
      description: desc.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
      color,
      owner_id: editingProject ? editingProject.owner_id : user?.id,
    };

    let projectId = editingProject?.id;

    if (editingProject) {
      const { error } = await supabase.from('projects').update(projectData).eq('id', editingProject.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { data, error } = await supabase.from('projects').insert(projectData).select().single();
      if (error) { toast.error(error.message); return; }
      projectId = data.id;
      toast.success('Project created');
    }

    // Sync project members
    if (projectId) {
      // Remove all current members first
      await supabase.from('project_members').delete().eq('project_id', projectId);
      
      // Add selected members
      if (teamIds.length > 0) {
        const memberInserts = teamIds.map(uid => ({ project_id: projectId, user_id: uid }));
        await supabase.from('project_members').insert(memberInserts);
      }
      
      if (editingProject) toast.success('Project updated');
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
        {projects.map((p, index) => {
          const pTasks = tasks.filter(t => t.project_id === p.id);
          const completed = pTasks.filter(t => t.status === 'done').length;
          const progress = pTasks.length > 0 ? Math.round((completed / pTasks.length) * 100) : 0;
          const cfg = PROJECT_STATUS_CONFIG[p.status];
          return (
            <motion.div 
              key={p.id} 
              className="glass-card" 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.4 }}
              whileHover={{ y: -5 }}
              style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}
            >
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
            </motion.div>
          );
        })}
      </div>

      {projects.length === 0 && (
        <motion.div className="empty-state" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <motion.div className="empty-icon" animate={{ y: [0, -10, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>📁</motion.div>
          <h3>No projects yet</h3>
          <p>Create your first project to get started.</p>
        </motion.div>
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
              <h2>{editingProject ? 'Edit Project' : 'New Project'}</h2>
              <button className="btn-ghost" onClick={() => { setShowModal(false); resetForm(); }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group"><label htmlFor="projectName" className="form-label">Name *</label><input id="projectName" className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Project name" /></div>
              <div className="form-group"><label htmlFor="projectDesc" className="form-label">Description</label><textarea id="projectDesc" className="form-textarea" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Describe the project..." /></div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group"><label htmlFor="projectStartDate" className="form-label">Start Date</label><input id="projectStartDate" className="form-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                <div className="form-group"><label htmlFor="projectEndDate" className="form-label">End Date</label><input id="projectEndDate" className="form-input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
                <div className="form-group"><label htmlFor="projectColor" className="form-label">Color</label><input id="projectColor" aria-label="Project Color" type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: '100%', height: '42px', border: 'none', borderRadius: '8px', cursor: 'pointer' }} /></div>
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
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

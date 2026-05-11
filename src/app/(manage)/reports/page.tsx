'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG } from '@/lib/types';
import type { Task, Profile, Project } from '@/lib/types';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function ReportsPage() {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user || !profile) return;

    let taskQuery = supabase.from('tasks').select('*');
    let memberQuery = supabase.from('profiles').select('*').eq('is_active', true);

    // Filter for Team Members
    if (profile.role === 'team_member') {
      taskQuery = taskQuery.eq('assignee_id', user.id);
      memberQuery = memberQuery.eq('id', user.id);
    }

    const [tRes, mRes, pRes] = await Promise.all([
      taskQuery,
      memberQuery,
      supabase.from('projects').select('*'),
    ]);
    
    if (tRes.data) setTasks(tRes.data as Task[]);
    if (mRes.data) setMembers(mRes.data as Profile[]);
    if (pRes.data) setProjects(pRes.data as Project[]);
    setLoading(false);
  }, [user, profile]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length;

  // Workload distribution
  const workloadData = {
    labels: members.slice(0, 10).map(m => m.full_name?.split(' ')[0] || 'User'),
    datasets: [{
      label: 'Assigned Tasks',
      data: members.slice(0, 10).map(m => tasks.filter(t => t.assignee_id === m.id).length),
      backgroundColor: 'rgba(99,102,241,0.6)',
      borderColor: '#6366f1',
      borderWidth: 1, borderRadius: 8,
    }],
  };

  // Project summary
  const projectSummary = projects.map(p => {
    const pTasks = tasks.filter(t => t.project_id === p.id);
    const pDone = pTasks.filter(t => t.status === 'completed').length;
    return { ...p, totalTasks: pTasks.length, doneTasks: pDone, progress: pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0 };
  });

  const exportToExcel = () => {
    if (tasks.length === 0) {
      alert('No data to export');
      return;
    }

    // Prepare data
    const headers = ['Task ID', 'Title', 'Description', 'Status', 'Priority', 'Assignee', 'Project', 'Due Date', 'Created At'];
    const rows = tasks.map(t => [
      t.id,
      t.title,
      t.description || '',
      TASK_STATUS_CONFIG[t.status]?.label || t.status,
      TASK_PRIORITY_CONFIG[t.priority]?.label || t.priority,
      members.find(m => m.id === t.assignee_id)?.full_name || 'Unassigned',
      projects.find(p => p.id === t.project_id)?.name || 'None',
      t.due_date ? new Date(t.due_date).toLocaleDateString() : 'N/A',
      new Date(t.created_at).toLocaleString()
    ]);

    // CSV content with BOM for Excel compatibility
    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Nexus_Overall_Report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <AppLayout><div className="loading-page"><div className="spinner" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <div className="subtitle">Analytics & insights</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={exportToExcel}>
            📥 Download Overall Report
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'Total Tasks', value: total, icon: '📋', color: 'var(--blue)' },
          { label: 'Completed', value: completed, icon: '✅', color: 'var(--green)' },
          { label: 'Completion Rate', value: `${total > 0 ? Math.round((completed / total) * 100) : 0}%`, icon: '📈', color: 'var(--purple)' },
          { label: 'Overdue', value: overdue, icon: '⚠️', color: 'var(--red)' },
        ].map(k => (
          <div key={k.label} className="glass-card kpi-card">
            <div className="kpi-icon" style={{ background: k.color + '20', color: k.color }}>{k.icon}</div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="charts-grid">
        {/* Status breakdown */}
        <div className="glass-card chart-card">
          <h3>Status Breakdown</h3>
          <div className="chart-container" style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '220px', height: '220px' }}>
              <Doughnut data={{
                labels: Object.values(TASK_STATUS_CONFIG).map(c => c.label),
                datasets: [{ data: Object.keys(TASK_STATUS_CONFIG).map(s => tasks.filter(t => t.status === s).length), backgroundColor: Object.values(TASK_STATUS_CONFIG).map(c => c.color), borderWidth: 0 }],
              }} options={{ responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } } } }} />
            </div>
          </div>
        </div>

        {/* Workload */}
        <div className="glass-card chart-card">
          <h3>Workload Distribution</h3>
          <div className="chart-container">
            <Bar data={workloadData} options={{
              responsive: true, maintainAspectRatio: false,
              scales: { x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.04)' } }, y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.04)' } } },
            }} />
          </div>
        </div>
      </div>

      {/* Project Summary Table */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px' }}>Project Summary</h3>
        <table className="data-table">
          <thead><tr><th>Project</th><th>Status</th><th>Tasks</th><th>Done</th><th>Progress</th></tr></thead>
          <tbody>
            {projectSummary.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td><span className="badge" style={{ background: (p.status === 'active' ? 'var(--green)' : 'var(--text-muted)') + '20', color: p.status === 'active' ? 'var(--green)' : 'var(--text-muted)' }}>{p.status}</span></td>
                <td>{p.totalTasks}</td>
                <td>{p.doneTasks}</td>
                <td style={{ minWidth: '120px' }}><div className="progress-bar"><div className="fill" style={{ width: `${p.progress}%` }} /></div></td>
              </tr>
            ))}
            {projectSummary.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No projects</td></tr>}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}

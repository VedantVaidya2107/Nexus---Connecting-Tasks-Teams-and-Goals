'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/lib/supabase';
import { TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG } from '@/lib/types';
import type { Task, Profile, Project } from '@/lib/types';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function ReportsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [tRes, mRes, pRes] = await Promise.all([
      supabase.from('tasks').select('*'),
      supabase.from('profiles').select('*').eq('is_active', true),
      supabase.from('projects').select('*'),
    ]);
    if (tRes.data) setTasks(tRes.data as Task[]);
    if (mRes.data) setMembers(mRes.data as Profile[]);
    if (pRes.data) setProjects(pRes.data as Project[]);
    setLoading(false);
  }, []);

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

  if (loading) return <AppLayout><div className="loading-page"><div className="spinner" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="page-header"><div><h1>Reports</h1><div className="subtitle">Analytics & insights</div></div></div>

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

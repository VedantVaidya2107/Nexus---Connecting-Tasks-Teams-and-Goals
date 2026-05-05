'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/lib/supabase';
import { TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG } from '@/lib/types';
import type { Task, ActivityLog, Profile } from '@/lib/types';
import {
  Chart as ChartJS,
  ArcElement, CategoryScale, LinearScale,
  BarElement, PointElement, LineElement,
  Tooltip, Legend, Filler,
} from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler);

const chartDefaults = {
  plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } } } },
  scales: {
    x: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
    y: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
  },
};

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<(ActivityLog & { user?: Profile })[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [tasksRes, actRes, membersRes] = await Promise.all([
      supabase.from('tasks').select('*, assignee:profiles!tasks_assignee_id_fkey(*)'),
      supabase.from('activity_log').select('*, user:profiles(*)').order('created_at', { ascending: false }).limit(15),
      supabase.from('profiles').select('*').eq('is_active', true),
    ]);
    if (tasksRes.data) setTasks(tasksRes.data as Task[]);
    if (actRes.data) setActivities(actRes.data as (ActivityLog & { user?: Profile })[]);
    if (membersRes.data) setMembers(membersRes.data as Profile[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusCounts = Object.fromEntries(
    Object.keys(TASK_STATUS_CONFIG).map(s => [s, tasks.filter(t => t.status === s).length])
  );
  const completed = statusCounts['done'] || 0;
  const total = tasks.length;
  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const kpis = [
    { label: 'Total Tasks', value: total, icon: '📋', color: 'var(--blue)', change: '+12%', positive: true, href: '/tasks' },
    { label: 'Completed', value: completed, icon: '✅', color: 'var(--green)', change: `${completionRate}%`, positive: true, href: '/tasks?status=done' },
    { label: 'In Progress', value: statusCounts['in_progress'] || 0, icon: '🔄', color: 'var(--cyan)', change: '', positive: true, href: '/tasks?status=in_progress' },
    { label: 'Overdue', value: overdue, icon: '⚠️', color: 'var(--red)', change: overdue > 0 ? 'Needs attention' : 'None', positive: overdue === 0, href: '/tasks?filter=overdue' },
    { label: 'Blocked', value: statusCounts['blocked'] || 0, icon: '🚫', color: 'var(--amber)', change: '', positive: true, href: '/tasks?status=blocked' },
    { label: 'Team Members', value: members.length, icon: '👥', color: 'var(--purple)', change: 'Active', positive: true, href: '/team' },
  ];

  const statusChartData = {
    labels: Object.values(TASK_STATUS_CONFIG).map(c => c.label),
    datasets: [{
      data: Object.keys(TASK_STATUS_CONFIG).map(s => statusCounts[s] || 0),
      backgroundColor: Object.values(TASK_STATUS_CONFIG).map(c => c.color),
      borderWidth: 0, hoverOffset: 8,
    }],
  };

  const priorityChartData = {
    labels: Object.values(TASK_PRIORITY_CONFIG).map(c => c.label),
    datasets: [{
      label: 'Tasks',
      data: (['high', 'medium', 'low'] as const).map(p => tasks.filter(t => t.priority === p).length),
      backgroundColor: Object.values(TASK_PRIORITY_CONFIG).map(c => c.color + '80'),
      borderColor: Object.values(TASK_PRIORITY_CONFIG).map(c => c.color),
      borderWidth: 1, borderRadius: 8,
    }],
  };

  // Team performance
  const teamData = members.slice(0, 8).map(m => ({
    name: m.full_name?.split(' ')[0] || 'User',
    completed: tasks.filter(t => t.assignee_id === m.id && t.status === 'done').length,
    total: tasks.filter(t => t.assignee_id === m.id).length,
  }));

  const teamChartData = {
    labels: teamData.map(d => d.name),
    datasets: [
      { label: 'Completed', data: teamData.map(d => d.completed), backgroundColor: '#22c55e80', borderColor: '#22c55e', borderWidth: 1, borderRadius: 6 },
      { label: 'Total', data: teamData.map(d => d.total), backgroundColor: '#3b82f680', borderColor: '#3b82f6', borderWidth: 1, borderRadius: 6 },
    ],
  };

  // Trend (last 7 days mock from tasks)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
  const trendData = {
    labels: last7.map(d => new Date(d).toLocaleDateString('en', { weekday: 'short' })),
    datasets: [{
      label: 'Completed',
      data: last7.map(d => tasks.filter(t => t.status === 'done' && t.updated_at?.startsWith(d)).length),
      borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)',
      fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#6366f1',
    }],
  };

  if (loading) return <AppLayout><div className="loading-page"><div className="spinner" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <div className="subtitle">Overview of your workspace</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => window.location.href = '/tasks'}>
            ＋ New Task
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {kpis.map(kpi => (
          <div 
            key={kpi.label} 
            className="glass-card kpi-card" 
            style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
            onClick={() => window.location.href = kpi.href}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div className="kpi-icon" style={{ background: kpi.color + '20', color: kpi.color }}>{kpi.icon}</div>
            <div className="kpi-label">{kpi.label}</div>
            <div className="kpi-value">{kpi.value}</div>
            {kpi.change && (
              <div className={`kpi-change ${kpi.positive ? 'positive' : 'negative'}`}>
                {kpi.positive ? '↑' : '↓'} {kpi.change}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="glass-card chart-card">
          <h3>Task Status Distribution</h3>
          <div className="chart-container" style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '240px', height: '240px' }}>
              <Doughnut data={statusChartData} options={{ responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 12, font: { size: 11 } } } } }} />
            </div>
          </div>
        </div>

        <div className="glass-card chart-card">
          <h3>Tasks by Priority</h3>
          <div className="chart-container">
            <Bar data={priorityChartData} options={{ ...chartDefaults, responsive: true, maintainAspectRatio: false, indexAxis: 'y' as const }} />
          </div>
        </div>

        <div className="glass-card chart-card">
          <h3>Completion Trend (7 days)</h3>
          <div className="chart-container">
            <Line data={trendData} options={{ ...chartDefaults, responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>

        <div className="glass-card chart-card">
          <h3>Team Performance</h3>
          <div className="chart-container">
            <Bar data={teamChartData} options={{ ...chartDefaults, responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      {/* Bottom Section: Activity + Overdue */}
      <div className="charts-grid">
        <div className="glass-card chart-card">
          <h3>Recent Activity</h3>
          {activities.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📭</div><h3>No activity yet</h3><p>Actions will appear here as your team works.</p></div>
          ) : (
            <ul className="activity-feed">
              {activities.map(a => (
                <li key={a.id} className="activity-item">
                  <div className="user-avatar" style={{ width: 32, height: 32, fontSize: 12, flexShrink: 0 }}>
                    {a.user?.full_name?.[0] || '?'}
                  </div>
                  <div>
                    <div className="activity-text"><strong>{a.user?.full_name || 'Someone'}</strong> {a.action} {a.entity_name && <em>{a.entity_name}</em>}</div>
                    <div className="activity-time">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass-card chart-card">
          <h3>Overdue Tasks</h3>
          {overdue === 0 ? (
            <div className="empty-state"><div className="empty-icon">🎉</div><h3>All on track!</h3><p>No overdue tasks at the moment.</p></div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Task</th><th>Assignee</th><th>Due</th></tr>
              </thead>
              <tbody>
                {tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').slice(0, 8).map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.title}</td>
                    <td>{(t.assignee as unknown as Profile)?.full_name || 'Unassigned'}</td>
                    <td style={{ color: 'var(--red)' }}>{t.due_date && new Date(t.due_date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

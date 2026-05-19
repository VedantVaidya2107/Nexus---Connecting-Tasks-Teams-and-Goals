'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
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
import { 
  Layout, 
  Clock, 
  RefreshCw, 
  Building2, 
  User, 
  Users, 
  CheckCircle2, 
  XCircle, 
  TrendingUp 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Counter = ({ value }: { value: number }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let startTime: number;
    const duration = 1000;
    const update = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(ease * value));
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }, [value]);
  return <>{count}</>;
};

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler);

const chartDefaults = {
  plugins: { legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } } } },
  scales: {
    x: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
    y: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
  },
};

export default function DashboardPage() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<(ActivityLog & { user?: Profile })[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterTime, setFilterTime] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  const fetchData = useCallback(async () => {
    if (!profile) return;
    setRefreshing(true);
    
    try {
      let tasksQuery = supabase.from('tasks').select('*, assignee:profiles!tasks_assignee_id_fkey(*)');
      
      // Privacy: Members only see their own tasks
      if (profile.role === 'team_member') {
        tasksQuery = tasksQuery.eq('assignee_id', profile.id);
      }

      const [tasksRes, actRes, membersRes] = await Promise.all([
        tasksQuery,
        supabase.from('activity_log').select('*, user:profiles(*)').order('created_at', { ascending: false }).limit(15),
        supabase.from('profiles').select('*').eq('is_active', true),
      ]);
      
      if (tasksRes.data) setTasks(tasksRes.data as Task[]);
      if (actRes.data) setActivities(actRes.data as (ActivityLog & { user?: Profile })[]);
      if (membersRes.data) setMembers(membersRes.data as Profile[]);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => { 
    if (profile) fetchData(); 
  }, [fetchData, profile]);

  const filteredTasks = tasks.filter(t => {
    const userMatch = filterUser === 'all' || t.assignee_id === filterUser;
    let timeMatch = true;
    if (filterTime !== 'all') {
      const taskDate = new Date(t.created_at);
      const now = new Date();
      if (filterTime === 'today') {
        timeMatch = taskDate.toDateString() === now.toDateString();
      } else if (filterTime === 'this_week') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        timeMatch = taskDate >= startOfWeek;
      } else if (filterTime === 'this_month') {
        timeMatch = taskDate.getMonth() === now.getMonth() && taskDate.getFullYear() === now.getFullYear();
      } else if (filterTime === 'custom') {
        if (filterStartDate) {
          const start = new Date(filterStartDate);
          start.setHours(0, 0, 0, 0);
          if (taskDate < start) timeMatch = false;
        }
        if (filterEndDate && timeMatch) {
          const end = new Date(filterEndDate);
          end.setHours(23, 59, 59, 999);
          if (taskDate > end) timeMatch = false;
        }
      }
    }
    return userMatch && timeMatch;
  });

  const statusCounts = Object.fromEntries(
    Object.keys(TASK_STATUS_CONFIG).map(s => [s, filteredTasks.filter(t => t.status === s).length])
  );
  const completed = statusCounts['done'] || 0;
  const total = filteredTasks.length;
  const overdue = filteredTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const kpis = [
    { label: 'Total Tasks', value: total, icon: Layout, color: 'var(--blue)', href: '/tasks', trend: 'Global Overview' },
    { label: 'Pending', value: statusCounts['pending'] || 0, icon: Clock, color: 'var(--slate)', href: '/tasks?status=pending', trend: `${total > 0 ? Math.round((statusCounts['pending'] / total) * 100) : 0}% of Total` },
    { label: 'In Progress', value: statusCounts['in_progress'] || 0, icon: RefreshCw, color: 'var(--cyan)', href: '/tasks?status=in_progress', trend: 'Active Sprint' },
    { label: 'Awaiting Zoho', value: statusCounts['awaiting_zoho'] || 0, icon: Building2, color: 'var(--amber)', href: '/tasks?status=awaiting_zoho', trend: 'External Dependency' },
    { label: 'Awaiting Client', value: statusCounts['awaiting_client'] || 0, icon: User, color: 'var(--amber)', href: '/tasks?status=awaiting_client', trend: 'Awaiting Feedback' },
    { label: 'Awaiting Team', value: statusCounts['awaiting_team'] || 0, icon: Users, color: 'var(--amber)', href: '/tasks?status=awaiting_team', trend: 'Internal Review' },
    { label: 'Done', value: completed, icon: CheckCircle2, color: 'var(--green)', href: '/tasks?status=done', trend: `${completionRate}% Success Rate` },
    { label: 'Cancelled', value: statusCounts['cancelled'] || 0, icon: XCircle, color: 'var(--red)', href: '/tasks?status=cancelled', trend: 'Deprioritized' },
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
      data: (['high', 'medium', 'low'] as const).map(p => filteredTasks.filter(t => t.priority === p).length),
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
      data: last7.map(d => filteredTasks.filter(t => t.status === 'done' && t.updated_at?.startsWith(d)).length),
      borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)',
      fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#6366f1',
    }],
  };

  const exportData = () => {
    if (tasks.length === 0) return;
    const headers = ['Title', 'Status', 'Priority', 'Assignee', 'Due Date'];
    const rows = tasks.map(t => [
      t.title,
      TASK_STATUS_CONFIG[t.status]?.label || t.status,
      TASK_PRIORITY_CONFIG[t.priority]?.label || t.priority,
      members.find(m => m.id === t.assignee_id)?.full_name || 'Unassigned',
      t.due_date ? new Date(t.due_date).toLocaleDateString() : 'N/A'
    ]);
    const csv = "\uFEFF" + [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Nexus_Dashboard_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="loading-page">
          <div className="spinner" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-actions dashboard-actions">
        <select 
          aria-label="Filter by Time"
          className="form-select dashboard-filter-select min-w-140" 
          value={filterTime}
          onChange={e => setFilterTime(e.target.value)}
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="this_week">This Week</option>
          <option value="this_month">This Month</option>
          <option value="custom">Custom Range</option>
        </select>
        {filterTime === 'custom' && (
          <div className="dashboard-custom-date">
            <input aria-label="Start Date" type="date" className="form-input dashboard-date-input" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
            <span className="dashboard-date-separator">to</span>
            <input aria-label="End Date" type="date" className="form-input dashboard-date-input" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
          </div>
        )}
        {profile?.role === 'admin' && (
          <select 
            aria-label="Filter by Team Member"
            className="form-select dashboard-filter-select min-w-160" 
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
          >
            <option value="all">All Team Members</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </select>
        )}
        <button 
          className="btn btn-secondary" 
          onClick={fetchData} 
          disabled={refreshing} 
          title="Refresh dashboard data"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw 
            size={16} 
            style={{ 
              animation: refreshing ? 'spin 1s linear infinite' : 'none',
            }} 
          />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
        <button className="btn btn-secondary" onClick={exportData} title="Export overall data">
          📥 Export
        </button>
        <button className="btn btn-primary" onClick={() => window.location.href = '/tasks'}>
          ＋ New Task
        </button>
      </div>

      <div className="kpi-grid">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          const kpiColor = kpi.color;
          return (
            <motion.div 
              key={kpi.label} 
              className="glass-card kpi-card" 
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              style={{ 
                cursor: kpi.value > 0 ? 'pointer' : 'default',
                position: 'relative',
                overflow: 'hidden',
                transition: 'border-color 0.5s, box-shadow 0.5s'
              }}
              onClick={() => kpi.value > 0 && (window.location.href = kpi.href)}
              onMouseEnter={(e) => {
                if (kpi.value > 0) {
                  const target = e.currentTarget;
                  target.style.transform = 'translateY(-10px) scale(1.02)';
                  target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                  target.style.boxShadow = '0 20px 40px -15px rgba(0,0,0,0.5)';
                  const hint = target.querySelector('.kpi-hint') as HTMLElement;
                  if (hint) { hint.style.opacity = '1'; hint.style.transform = 'translateY(0)'; }
                  const watermark = target.querySelector('.kpi-watermark') as HTMLElement;
                  if (watermark) { watermark.style.opacity = '0.25'; watermark.style.transform = 'rotate(0deg) scale(1.1)'; }
                }
              }}
              onMouseLeave={(e) => {
                const target = e.currentTarget;
                target.style.transform = 'translateY(0) scale(1)';
                target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                target.style.boxShadow = 'var(--glass-shadow)';
                const hint = target.querySelector('.kpi-hint') as HTMLElement;
                if (hint) { hint.style.opacity = '0'; hint.style.transform = 'translateY(10px)'; }
                const watermark = target.querySelector('.kpi-watermark') as HTMLElement;
                if (watermark) { watermark.style.opacity = '0.15'; watermark.style.transform = 'rotate(15deg) scale(1)'; }
              }}
            >
              <div 
                className="kpi-watermark"
                style={{ 
                  position: 'absolute', top: '-10px', right: '-10px', opacity: 0.15, zIndex: 0,
                  transform: 'rotate(15deg)', transition: 'all 0.5s ease', color: kpiColor,
                  animation: 'spin 30s linear infinite'
                }} 
              >
                <Icon size={110} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', position: 'relative', zIndex: 1, marginBottom: '24px' }}>
                <div style={{ 
                  background: 'rgba(255,255,255,0.1)', color: '#fff', 
                  width: '52px', height: '52px', borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Icon size={26} strokeWidth={2.5} />
                </div>
                <div style={{ fontSize: '10px', fontWeight: 900, color: kpiColor, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {kpi.trend}
                </div>
              </div>

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="kpi-label" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{kpi.label}</div>
                <div className="kpi-value" style={{ fontSize: '36px', fontWeight: 900, margin: '8px 0', color: 'var(--text-primary)' }}><Counter value={kpi.value} /></div>
              </div>

              <div className="kpi-hint" style={{ 
                marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', 
                opacity: 0, transform: 'translateY(10px)', transition: 'all 0.3s ease'
              }}>
                <div style={{ padding: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}>
                  <TrendingUp size={14} />
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  View Details
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="charts-grid">
        <motion.div className="glass-card chart-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
          <h3>Task Status Distribution</h3>
          <div className="chart-container" style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '240px', height: '240px' }}>
              <Doughnut data={statusChartData} options={{ responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 12, font: { size: 11 } } } } }} />
            </div>
          </div>
        </motion.div>

        <motion.div className="glass-card chart-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}>
          <h3>Tasks by Priority</h3>
          <div className="chart-container">
            <Bar data={priorityChartData} options={{ ...chartDefaults, responsive: true, maintainAspectRatio: false, indexAxis: 'y' as const }} />
          </div>
        </motion.div>

        <motion.div className="glass-card chart-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }} style={{ gridColumn: 'span 2' }}>
          <h3>Task Completion Trend (Last 7 Days)</h3>
          <div className="chart-container">
            <Line data={trendData} options={{ ...chartDefaults, responsive: true, maintainAspectRatio: false }} />
          </div>
        </motion.div>
      </div>

      <div className="charts-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <motion.div className="glass-card chart-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}>
          <h3>Recent Team Activity</h3>
          <ul className="activity-feed">
            {activities.length > 0 ? activities.map((act, idx) => (
              <motion.li 
                key={act.id} 
                className="activity-item"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + idx * 0.05, duration: 0.4 }}
              >
                <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
                  {act.user?.full_name?.charAt(0) || '?'}
                </div>
                <div className="activity-content">
                  <div className="activity-text">
                    <strong>{act.user?.full_name || 'System'}</strong> {act.action}
                  </div>
                  <div className="activity-time">{new Date(act.created_at).toLocaleString()}</div>
                </div>
              </motion.li>
            )) : <li className="empty-state">No recent activity</li>}
          </ul>
        </motion.div>

        <motion.div className="glass-card chart-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>Critical Overdue</h3>
            <span className="badge" style={{ background: 'var(--red)', color: 'white', animation: 'dotPulse 1.5s infinite' }}>{overdue}</span>
          </div>
          {overdue === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
              <p>All critical tasks are on track</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Task</th><th>Assignee</th><th>Due</th></tr>
              </thead>
              <tbody>
                {filteredTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').slice(0, 8).map(t => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.title}</td>
                    <td>{(t.assignee as unknown as Profile)?.full_name || 'Unassigned'}</td>
                    <td style={{ color: 'var(--red)' }}>{t.due_date && new Date(t.due_date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}

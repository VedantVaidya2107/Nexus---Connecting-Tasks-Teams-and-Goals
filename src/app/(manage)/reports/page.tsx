'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG } from '@/lib/types';
import type { Task, Profile, Project, TimeEntry } from '@/lib/types';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function ReportsPage() {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
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

    let timeQuery = supabase.from('time_entries').select('*, user:profiles(id,full_name), task:tasks(id,title,project_id)');
    if (profile.role === 'team_member') {
      timeQuery = timeQuery.eq('user_id', user.id);
    }

    const [tRes, mRes, pRes, teRes] = await Promise.all([
      taskQuery,
      memberQuery,
      supabase.from('projects').select('*'),
      timeQuery,
    ]);
    
    if (tRes.data) setTasks(tRes.data as Task[]);
    if (mRes.data) setMembers(mRes.data as Profile[]);
    if (pRes.data) setProjects(pRes.data as Project[]);
    if (teRes.data) setTimeEntries(teRes.data as TimeEntry[]);
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
      {/* Time Summary Section */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: 8 }}>
          ⏱ Time Summary
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>— hours logged across all tasks</span>
        </h3>

        {/* Time KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Hours Logged', value: fmtDuration(timeEntries.reduce((s,e) => s + e.duration_minutes, 0)), color: '#6366f1' },
            { label: 'Entries Count', value: String(timeEntries.length), color: '#06b6d4' },
            { label: 'Avg per Entry', value: timeEntries.length > 0 ? fmtDuration(Math.round(timeEntries.reduce((s,e) => s+e.duration_minutes,0)/timeEntries.length)) : '—', color: '#22c55e' },
          ].map(k => (
            <div key={k.label} style={{ padding: '14px 16px', borderRadius: 10, background: k.color + '14', border: `1px solid ${k.color}30` }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Hours by Member Bar Chart */}
        {profile?.role !== 'team_member' && members.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Hours by Member</div>
            <div style={{ height: 180 }}>
              <Bar
                data={{
                  labels: members.slice(0, 10).map(m => m.full_name?.split(' ')[0] || 'User'),
                  datasets: [{
                    label: 'Hours Logged',
                    data: members.slice(0, 10).map(m =>
                      Math.round(timeEntries.filter(e => e.user_id === m.id).reduce((s,e) => s+e.duration_minutes,0) / 60 * 10) / 10
                    ),
                    backgroundColor: 'rgba(99,102,241,0.5)',
                    borderColor: '#6366f1',
                    borderWidth: 1, borderRadius: 6,
                  }],
                }}
                options={{
                  responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' }, title: { display: true, text: 'Hours', color: '#64748b', font: { size: 11 } } },
                    y: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
                  },
                }}
              />
            </div>
          </div>
        )}

        {/* Time by Project */}
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Time by Project</div>
        <table className="data-table">
          <thead><tr><th>Project</th><th>Hours Logged</th><th>Entries</th><th>Distribution</th></tr></thead>
          <tbody>
            {(() => {
              const totalTime = timeEntries.reduce((s,e)=>s+e.duration_minutes,0);
              const projectTime = projects.map(p => {
                const pEntries = timeEntries.filter(e => (e.task as any)?.project_id === p.id);
                const pMins = pEntries.reduce((s,e)=>s+e.duration_minutes,0);
                return { ...p, mins: pMins, count: pEntries.length, pct: totalTime>0?Math.round(pMins/totalTime*100):0 };
              }).filter(p => p.mins > 0).sort((a,b) => b.mins - a.mins);
              const unlinked = timeEntries.filter(e => !(e.task as any)?.project_id);
              const unlinkedMins = unlinked.reduce((s,e)=>s+e.duration_minutes,0);
              return [
                ...projectTime.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}><span style={{ width:8, height:8, borderRadius:'50%', background:p.color, display:'inline-block', marginRight:8 }} />{p.name}</td>
                    <td style={{ fontWeight: 700, color: '#6366f1' }}>{fmtDuration(p.mins)}</td>
                    <td style={{ color:'var(--text-muted)' }}>{p.count}</td>
                    <td style={{ minWidth:120 }}>
                      <div className="progress-bar"><div className="fill" style={{ width:`${p.pct}%`, background:'#6366f1' }} /></div>
                      <span style={{fontSize:11,color:'var(--text-muted)'}}>{p.pct}%</span>
                    </td>
                  </tr>
                )),
                unlinkedMins > 0 && (
                  <tr key="unlinked">
                    <td style={{ color:'var(--text-muted)' }}>No project</td>
                    <td style={{ fontWeight:700, color:'#6366f1' }}>{fmtDuration(unlinkedMins)}</td>
                    <td style={{ color:'var(--text-muted)' }}>{unlinked.length}</td>
                    <td><div className="progress-bar"><div className="fill" style={{ width:`${totalTime>0?Math.round(unlinkedMins/totalTime*100):0}%`, background:'#94a3b8' }} /></div></td>
                  </tr>
                ),
              ];
            })()}
            {timeEntries.length === 0 && <tr><td colSpan={4} style={{ textAlign:'center', color:'var(--text-muted)' }}>No time entries yet</td></tr>}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}

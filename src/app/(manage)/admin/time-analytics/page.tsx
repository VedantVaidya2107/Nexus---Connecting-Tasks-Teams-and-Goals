'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import type { TimeEntry, Profile, Project } from '@/lib/types';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend, PointElement, LineElement } from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend, PointElement, LineElement);

// ─── Helpers ─────────────────────────────────────────────────
function fmtDuration(mins: number) {
  if (!mins || mins <= 0) return '0h';
  const h = Math.floor(mins / 60); const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtDurationHMS(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const s = 0;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CHART_COLORS = ['#6366f1','#06b6d4','#22c55e','#f59e0b','#a855f7','#ec4899','#ef4444','#14b8a6','#f97316','#84cc16'];

// ─── Component ───────────────────────────────────────────────
export default function TimeAnalyticsPage() {
  const { profile } = useAuth();
  const router = useRouter();

  // Redirect non-admins
  useEffect(() => {
    if (profile && profile.role !== 'admin' && profile.role !== 'manager') {
      router.replace('/dashboard');
    }
  }, [profile, router]);

  // Data
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth()); // 0-indexed
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMember, setSelMember] = useState('all');
  const [selProject, setSelProject] = useState('all');
  const [selBillable, setSelBillable] = useState<'all' | 'billable' | 'non_billable'>('all');

  // Custom ORG Threshold states
  const [thresholdHours, setThresholdHours] = useState(207);
  const [showBillable, setShowBillable] = useState(true);
  const [showNonBillable, setShowNonBillable] = useState(true);

  // Year options
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  // Fetch
  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [eRes, mRes, pRes] = await Promise.all([
        supabase
          .from('time_entries')
          .select('*, user:profiles(id,full_name,avatar_url), task:tasks(id,title,project_id)')
          .order('logged_date', { ascending: true }),
        supabase.from('profiles').select('id,full_name,avatar_url').eq('is_active', true),
        supabase.from('projects').select('id,name,color').eq('status', 'active'),
      ]);
      if (eRes.data) setEntries(eRes.data as TimeEntry[]);
      if (mRes.data) setMembers(mRes.data as Profile[]);
      if (pRes.data) setProjects(pRes.data as Project[]);
    } finally {
      setLoading(false);
    }
  }, []);



  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Filtered entries ─────────────────────────────────────────
  const filtered = useMemo(() => {
    return entries.filter(e => {
      const d = new Date(e.logged_date);
      if (d.getMonth() !== selMonth || d.getFullYear() !== selYear) return false;
      if (selMember !== 'all' && e.user_id !== selMember) return false;
      if (selProject !== 'all') {
        const pid = (e.task as any)?.project_id;
        if (pid !== selProject) return false;
      }
      if (selBillable === 'billable' && !e.is_billable) return false;
      if (selBillable === 'non_billable' && e.is_billable) return false;
      return true;
    });
  }, [entries, selMonth, selYear, selMember, selProject, selBillable]);

  // ── KPIs ─────────────────────────────────────────────────────
  const totalMins = filtered.reduce((s, e) => s + e.duration_minutes, 0);
  const billableMins = filtered.filter(e => e.is_billable).reduce((s, e) => s + e.duration_minutes, 0);
  const nonBillableMins = filtered.filter(e => !e.is_billable).reduce((s, e) => s + e.duration_minutes, 0);
  const billablePct = totalMins > 0 ? Math.round((billableMins / totalMins) * 100) : 0;
  const activeMemberCount = new Set(filtered.map(e => e.user_id)).size;

  // ── Per-member breakdown ──────────────────────────────────────
  const memberBreakdown = useMemo(() => {
    return members.map(m => {
      const mEntries = filtered.filter(e => e.user_id === m.id);
      const total = mEntries.reduce((s, e) => s + e.duration_minutes, 0);
      const billable = mEntries.filter(e => e.is_billable).reduce((s, e) => s + e.duration_minutes, 0);
      const nonBillable = total - billable;
      return { ...m, totalMins: total, billableMins: billable, nonBillableMins: nonBillable, entries: mEntries.length };
    }).filter(m => m.totalMins > 0).sort((a, b) => b.totalMins - a.totalMins);
  }, [members, filtered]);

  // ── Per-project breakdown ─────────────────────────────────────
  const projectBreakdown = useMemo(() => {
    return projects.map(p => {
      const pEntries = filtered.filter(e => (e.task as any)?.project_id === p.id);
      const total = pEntries.reduce((s, e) => s + e.duration_minutes, 0);
      const billable = pEntries.filter(e => e.is_billable).reduce((s, e) => s + e.duration_minutes, 0);
      return { ...p, totalMins: total, billableMins: billable, nonBillableMins: total - billable, entries: pEntries.length };
    }).filter(p => p.totalMins > 0).sort((a, b) => b.totalMins - a.totalMins);
  }, [projects, filtered]);

  // ── Daily trend (for the selected month) ─────────────────────
  const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();
  const dailyData = useMemo(() => {
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    return days.map(day => {
      const dateStr = `${selYear}-${String(selMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEntries = filtered.filter(e => e.logged_date === dateStr);
      return {
        day,
        total: Math.round(dayEntries.reduce((s, e) => s + e.duration_minutes, 0) / 60 * 10) / 10,
        billable: Math.round(dayEntries.filter(e => e.is_billable).reduce((s, e) => s + e.duration_minutes, 0) / 60 * 10) / 10,
        nonBillable: Math.round(dayEntries.filter(e => !e.is_billable).reduce((s, e) => s + e.duration_minutes, 0) / 60 * 10) / 10,
      };
    });
  }, [filtered, daysInMonth, selYear, selMonth]);

  // ── Billable vs Non-billable doughnut ─────────────────────────
  const doughnutData = {
    labels: ['Billable', 'Non-Billable'],
    datasets: [{
      data: [billableMins, nonBillableMins],
      backgroundColor: ['rgba(34,197,94,0.8)', 'rgba(148,163,184,0.6)'],
      borderColor: ['#22c55e', '#94a3b8'],
      borderWidth: 2,
    }],
  };

  // ── Member bar chart (Custom red/green stacked, sorted descending, up to 30 active members) ──
  const memberBarData = useMemo(() => {
    const slicedBreakdown = memberBreakdown.slice(0, 30);
    const datasets = [];

    // Dataset 0: Billable
    datasets.push({
      label: 'Billable',
      data: slicedBreakdown.map(m => showBillable ? m.billableMins / 60 : 0),
      backgroundColor: 'rgba(134, 239, 172, 0.9)', // Vibrant mockup green
      borderColor: '#86efac',
      borderWidth: 1,
    });

    // Dataset 1: Non-Billable
    datasets.push({
      label: 'Non-Billable',
      data: slicedBreakdown.map(m => showNonBillable ? m.nonBillableMins / 60 : 0),
      backgroundColor: 'rgba(248, 113, 113, 0.9)', // Vibrant mockup coral red
      borderColor: '#f87171',
      borderWidth: 1,
    });

    return {
      labels: slicedBreakdown.map(m => m.full_name || '?'),
      datasets,
    };
  }, [memberBreakdown, showBillable, showNonBillable]);

  // Custom inline ChartJS plugin for rendering target line + bar-top duration labels
  const productivityThresholdPlugin = useMemo(() => {
    return {
      id: 'productivityThresholdPlugin',
      afterDatasetsDraw(chart: any) {
        const { ctx, scales: { x, y } } = chart;

        // 1. Draw dashed target threshold line
        const yPixel = y.getPixelForValue(thresholdHours);
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = '#22c55e'; // Green
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.moveTo(x.left, yPixel);
        ctx.lineTo(x.right, yPixel);
        ctx.stroke();

        // Target hours label on the line
        ctx.fillStyle = '#22c55e';
        ctx.font = '900 10px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        const lineLabelText = `${thresholdHours}:00:00`;
        ctx.fillText(lineLabelText, x.left + 5, yPixel - 3);
        ctx.restore();

        // 2. Draw total duration (HHHH:MM:SS) labels on top of active stacked bars
        ctx.save();
        ctx.fillStyle = '#e2e8f0'; // High contrast slate-200
        ctx.font = '900 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        memberBreakdown.slice(0, 30).forEach((member, index) => {
          const meta0 = chart.getDatasetMeta(0);
          const meta1 = chart.getDatasetMeta(1);

          const element0 = meta0?.data[index];
          const element1 = meta1?.data[index];

          if (!element0) return;

          const val0 = chart.data.datasets[0]?.data[index] || 0;
          const val1 = chart.data.datasets[1]?.data[index] || 0;

          const hasVal0 = val0 > 0 && !meta0.hidden;
          const hasVal1 = val1 > 0 && !meta1.hidden;

          let topY = y.bottom;
          if (hasVal1 && element1) {
            topY = element1.y;
          } else if (hasVal0 && element0) {
            topY = element0.y;
          } else {
            return; // both hidden or zero
          }

          const labelText = fmtDurationHMS(member.totalMins);
          ctx.fillText(labelText, element0.x, topY - 6);
        });
        ctx.restore();
      }
    };
  }, [thresholdHours, memberBreakdown]);

  const productivityChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Customized in JSX
      },
      tooltip: {
        bodyFont: { size: 11, family: 'Inter, sans-serif' },
        titleFont: { size: 11, family: 'Inter, sans-serif' },
        callbacks: {
          label: (context: any) => {
            const val = context.raw || 0;
            const h = Math.floor(val);
            const m = Math.round((val - h) * 60);
            return ` ${context.dataset.label}: ${h}h ${m}m`;
          }
        }
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          color: '#94a3b8',
          font: { size: 9, weight: 'bold' as const, family: 'Inter, sans-serif' },
          maxRotation: 45,
          minRotation: 45,
        },
        grid: {
          display: false,
        },
      },
      y: {
        stacked: true,
        suggestedMax: thresholdHours + 20,
        ticks: {
          color: '#94a3b8',
          font: { size: 10, weight: 'bold' as const, family: 'Inter, sans-serif' },
          callback: (value: any) => `${value}h`,
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
      },
    },
  };

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#94a3b8', font: { size: 11 } } },
      tooltip: { bodyFont: { size: 11 }, titleFont: { size: 11 } },
    },
    scales: {
      x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' }, title: { display: true, text: 'Hours', color: '#64748b', font: { size: 10 } } },
    },
  };

  if (loading) return <AppLayout><div className="loading-page"><div className="spinner" /></div></AppLayout>;
  if (!profile || (profile.role !== 'admin' && profile.role !== 'manager')) return null;

  return (
    <AppLayout>
      {/* ── Header ── */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>📊</span>
            <span>Time Analytics</span>
            <span style={{ fontSize: 12, fontWeight: 600, background: 'rgba(99,102,241,0.15)', color: '#6366f1', borderRadius: 20, padding: '2px 10px', border: '1px solid rgba(99,102,241,0.3)' }}>Admin</span>
          </h1>
          <div className="subtitle">Billable &amp; non-billable hours across team, projects and time</div>
        </div>

      </div>

      {/* ── Filter Bar ── */}
      <motion.div className="glass-card"
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        style={{ padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>

        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginRight: 4 }}>🔍 Filters</span>

        {/* Month */}
        <select className="form-select analytics-filter-select bold"
          aria-label="Select Month" title="Select Month"
          value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>

        {/* Year */}
        <select className="form-select analytics-filter-select bold"
          aria-label="Select Year" title="Select Year"
          value={selYear} onChange={e => setSelYear(Number(e.target.value))}>
          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <div className="divider-v" />

        {/* Member */}
        <select className="form-select analytics-filter-select"
          aria-label="Filter by Team Member" title="Filter by Team Member"
          value={selMember} onChange={e => setSelMember(e.target.value)}>
          <option value="all">👥 All Members</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>

        {/* Project */}
        <select className="form-select analytics-filter-select"
          aria-label="Filter by Project" title="Filter by Project"
          value={selProject} onChange={e => setSelProject(e.target.value)}>
          <option value="all">📁 All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {/* Billable */}
        <select className="form-select analytics-filter-select"
          aria-label="Filter by Billing Type" title="Filter by Billing Type"
          value={selBillable} onChange={e => setSelBillable(e.target.value as any)}>
          <option value="all">💼 All Types</option>
          <option value="billable">💰 Billable</option>
          <option value="non_billable">🚫 Non-Billable</option>
        </select>

        <div className="flex-spacer" />
        <span className="filter-bar-count">
          {MONTHS[selMonth]} {selYear} · {filtered.length} entries
        </span>
      </motion.div>

      {/* ── KPI Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Hours', value: fmtDuration(totalMins), sub: `${filtered.length} entries`, color: '#6366f1', icon: '⏱' },
          { label: 'Billable Hours', value: fmtDuration(billableMins), sub: `${billablePct}% of total`, color: '#22c55e', icon: '💰' },
          { label: 'Non-Billable', value: fmtDuration(nonBillableMins), sub: `${100 - billablePct}% of total`, color: '#94a3b8', icon: '🚫' },
          { label: 'Active Members', value: String(activeMemberCount), sub: `of ${members.length} total`, color: '#06b6d4', icon: '👥' },
          { label: 'Avg / Member', value: activeMemberCount > 0 ? fmtDuration(Math.round(totalMins / activeMemberCount)) : '—', sub: 'per active member', color: '#f59e0b', icon: '📈' },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} className="glass-card"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
            style={{ padding: '14px 18px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -6, right: -6, fontSize: 44, opacity: 0.08 }}>{kpi.icon}</div>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{kpi.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{kpi.sub}</div>
            {/* Color accent bar */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: kpi.color, opacity: 0.5, borderRadius: '0 0 12px 12px' }} />
          </motion.div>
        ))}
      </div>

      {/* ── ORG - MONTHLY PRODUCTIVITY THRESHOLD SUMMARY (Full Width Card) ── */}
      <motion.div 
        className="glass-card" 
        initial={{ opacity: 0, y: 16 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }} 
        style={{ 
          padding: '24px 24px', 
          marginBottom: 24, 
          borderTop: '4px solid #1e3a8a', // Mockup matching dark blue line
          overflow: 'hidden' 
        }}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 20 
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.02em' }}>
            ORG - MONTHLY PRODUCTIVITY THRESHOLD SUMMARY
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {/* Interactive Threshold controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              <span style={{ fontWeight: 750, color: '#94a3b8' }}>Threshold:</span>
              <input 
                type="number"
                value={thresholdHours}
                onChange={(e) => setThresholdHours(Math.max(1, Number(e.target.value)))}
                className="threshold-input"
                aria-label="Productivity threshold in hours"
                title="Productivity threshold in hours"
                placeholder="207"
              />
              <span style={{ fontWeight: 600, color: '#e2e8f0' }}>hrs</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 6 }}>
                <span style={{ color: '#22c55e', fontWeight: 900, fontSize: 14 }}>···</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0' }}>Target</span>
              </div>
            </div>

            {/* Premium Legend Checkboxes */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Billable */}
              <div 
                onClick={() => setShowBillable(!showBillable)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  color: showBillable ? '#86efac' : '#94a3b8',
                  background: showBillable ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${showBillable ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                  padding: '3px 8px',
                  borderRadius: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{
                  width: 13,
                  height: 13,
                  borderRadius: 3,
                  background: showBillable ? '#22c55e' : 'transparent',
                  border: `1.5px solid ${showBillable ? '#22c55e' : '#64748b'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.1s ease'
                }}>
                  {showBillable && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span>Billable</span>
              </div>

              {/* Non-Billable */}
              <div 
                onClick={() => setShowNonBillable(!showNonBillable)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  userSelect: 'none',
                  fontSize: 12,
                  fontWeight: 700,
                  color: showNonBillable ? '#f87171' : '#94a3b8',
                  background: showNonBillable ? 'rgba(248, 113, 113, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${showNonBillable ? 'rgba(248, 113, 113, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                  padding: '3px 8px',
                  borderRadius: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{
                  width: 13,
                  height: 13,
                  borderRadius: 3,
                  background: showNonBillable ? '#ef4444' : 'transparent',
                  border: `1.5px solid ${showNonBillable ? '#ef4444' : '#64748b'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.1s ease'
                }}>
                  {showNonBillable && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span>Non-Billable</span>
              </div>
            </div>
          </div>
        </div>

        {memberBreakdown.length === 0 ? (
          <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No data for selected filters
          </div>
        ) : (
          <div style={{ height: 280, position: 'relative' }}>
            <Bar 
              data={memberBarData} 
              options={productivityChartOptions} 
              plugins={[productivityThresholdPlugin]} 
            />
          </div>
        )}
      </motion.div>

      {/* ── Balanced Side-by-Side Grid (Doughnut + Line Chart) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr', gap: 20, marginBottom: 24 }}>
        {/* Doughnut */}
        <motion.div className="glass-card" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }} style={{ padding: '22px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 750, marginBottom: 16 }}>Billing Split</div>
          <div style={{ height: 180, position: 'relative' }}>
            <Doughnut data={doughnutData} options={{
              responsive: true, maintainAspectRatio: false, cutout: '72%',
              plugins: {
                legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, padding: 12, boxWidth: 10 } },
                tooltip: { bodyFont: { size: 11 } },
              },
            }} />
            {/* Centre text */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', paddingBottom: 24 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#22c55e' }}>{billablePct}%</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Billable</div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>💰 Billable</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: '#22c55e' }}>{fmtDuration(billableMins)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.2)' }}>
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700 }}>🚫 Non-Billable</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: '#94a3b8' }}>{fmtDuration(nonBillableMins)}</span>
            </div>
          </div>
        </motion.div>

        {/* Daily Hours Trend Line Chart */}
        <motion.div className="glass-card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }} style={{ padding: '22px 20px' }}>
          <div style={{ fontSize: 14, fontWeight: 750, marginBottom: 4 }}>Daily Hours — {MONTHS[selMonth]} {selYear}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Billable vs non-billable hours per day</div>
          <div style={{ height: 216 }}>
            <Line
              data={{
                labels: dailyData.map(d => d.day),
                datasets: [
                  {
                    label: 'Billable (h)',
                    data: dailyData.map(d => d.billable),
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34,197,94,0.12)',
                    fill: true, tension: 0.4,
                    pointRadius: 3, pointHoverRadius: 6,
                    borderWidth: 2,
                  },
                  {
                    label: 'Non-Billable (h)',
                    data: dailyData.map(d => d.nonBillable),
                    borderColor: '#94a3b8',
                    backgroundColor: 'rgba(148,163,184,0.08)',
                    fill: true, tension: 0.4,
                    pointRadius: 3, pointHoverRadius: 6,
                    borderWidth: 2,
                  },
                ],
              }}
              options={{
                ...chartOptions,
                plugins: { ...chartOptions.plugins, legend: { ...chartOptions.plugins.legend, position: 'top' } },
              }}
            />
          </div>
        </motion.div>
      </div>

      {/* ── Member Table ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

        {/* Member breakdown table */}
        <motion.div className="glass-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>👥 Member Breakdown</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{memberBreakdown.length} members logged</span>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 340 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>💰 Billable</th>
                  <th>🚫 Non-Bill.</th>
                  <th>Total</th>
                  <th>Split</th>
                </tr>
              </thead>
              <tbody>
                {memberBreakdown.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>No data</td></tr>
                ) : memberBreakdown.map((m, i) => {
                  const bPct = m.totalMins > 0 ? Math.round((m.billableMins / m.totalMins) * 100) : 0;
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="user-avatar" style={{ width: 26, height: 26, fontSize: 10, background: CHART_COLORS[i % CHART_COLORS.length] + '33', color: CHART_COLORS[i % CHART_COLORS.length], border: `1px solid ${CHART_COLORS[i % CHART_COLORS.length]}44` }}>
                            {m.full_name?.[0] || '?'}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{m.full_name}</span>
                        </div>
                      </td>
                      <td><span style={{ color: '#22c55e', fontWeight: 700, fontSize: 12 }}>{fmtDuration(m.billableMins)}</span></td>
                      <td><span style={{ color: '#94a3b8', fontWeight: 700, fontSize: 12 }}>{fmtDuration(m.nonBillableMins)}</span></td>
                      <td><span style={{ color: '#6366f1', fontWeight: 700, fontSize: 12 }}>{fmtDuration(m.totalMins)}</span></td>
                      <td style={{ minWidth: 100 }}>
                        <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ width: `${bPct}%`, height: '100%', background: '#22c55e', borderRadius: 3 }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{bPct}% billable</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {memberBreakdown.length > 0 && (
            <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: '#22c55e', fontWeight: 700 }}>💰 {fmtDuration(billableMins)}</span>
              <span style={{ color: '#94a3b8', fontWeight: 700 }}>🚫 {fmtDuration(nonBillableMins)}</span>
              <span style={{ color: '#6366f1', fontWeight: 700 }}>Total: {fmtDuration(totalMins)}</span>
            </div>
          )}
        </motion.div>

        {/* Project breakdown table */}
        <motion.div className="glass-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>📁 Project Breakdown</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{projectBreakdown.length} projects</span>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 340 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>💰 Billable</th>
                  <th>🚫 Non-Bill.</th>
                  <th>Total</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {projectBreakdown.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>No data</td></tr>
                ) : projectBreakdown.map(p => {
                  const pct = totalMins > 0 ? Math.round((p.totalMins / totalMins) * 100) : 0;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color || '#6366f1', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                        </div>
                      </td>
                      <td><span style={{ color: '#22c55e', fontWeight: 700, fontSize: 12 }}>{fmtDuration(p.billableMins)}</span></td>
                      <td><span style={{ color: '#94a3b8', fontWeight: 700, fontSize: 12 }}>{fmtDuration(p.nonBillableMins)}</span></td>
                      <td><span style={{ color: '#6366f1', fontWeight: 700, fontSize: 12 }}>{fmtDuration(p.totalMins)}</span></td>
                      <td style={{ minWidth: 100 }}>
                        <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: p.color || '#6366f1', borderRadius: 3 }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{pct}% of total</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* ── Detailed Entry Log ── */}
      <motion.div className="glass-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.4 }} style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>📋 All Entries — {MONTHS[selMonth]} {selYear}</div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{filtered.length} records</span>
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Member</th>
                <th>Task</th>
                <th>Project</th>
                <th>Duration</th>
                <th>Type</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32 }}>No time entries found for the selected filters</td></tr>
              ) : [...filtered].reverse().map((e, i) => (
                <tr key={e.id}>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(e.logged_date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="user-avatar" style={{ width: 22, height: 22, fontSize: 9, background: CHART_COLORS[i % CHART_COLORS.length] + '33', color: CHART_COLORS[i % CHART_COLORS.length] }}>
                        {(e.user as any)?.full_name?.[0] || '?'}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{(e.user as any)?.full_name || '—'}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(e.task as any)?.title || <span style={{ color: 'var(--text-muted)' }}>No task</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {(() => {
                      const pid = (e.task as any)?.project_id;
                      const proj = projects.find(p => p.id === pid);
                      return proj ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: proj.color || '#6366f1' }} />
                          <span style={{ fontSize: 11 }}>{proj.name}</span>
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>;
                    })()}
                  </td>
                  <td>
                    <span style={{ padding: '2px 8px', borderRadius: 12, background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontSize: 11, fontWeight: 700 }}>
                      {fmtDuration(e.duration_minutes)}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                      background: e.is_billable ? 'rgba(34,197,94,0.12)' : 'rgba(148,163,184,0.12)',
                      color: e.is_billable ? '#22c55e' : '#94a3b8',
                    }}>
                      {e.is_billable ? '💰' : '🚫'}
                    </span>
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.description || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </AppLayout>
  );
}

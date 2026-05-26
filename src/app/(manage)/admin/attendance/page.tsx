'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { AttendanceRecord } from '@/lib/types';
import toast from 'react-hot-toast';

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDuration(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return checkIn ? 'Still in' : '—';
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

interface AttendanceSummary {
  total_records: number;
  checked_out: number;
  still_in: number;
  avg_hours: string;
  total_minutes: number;
}

export default function AdminAttendancePage() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<(AttendanceRecord & { user?: any })[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/attendance?from=${dateFrom}&to=${dateTo}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.records || []);
        setSummary(data.summary);
      } else {
        toast.error(data.message || 'Failed to load attendance');
      }
    } catch {
      toast.error('Failed to load attendance data.');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const exportCSV = () => {
    if (!records.length) return;
    const headers = ['Name', 'Email', 'Date', 'Check In', 'Check Out', 'Duration', 'IP In', 'Network Verified'];
    const rows = records.map(r => [
      r.user?.full_name || '—',
      r.user?.email || '—',
      r.date,
      formatTime(r.check_in_time),
      formatTime(r.check_out_time),
      formatDuration(r.check_in_time, r.check_out_time),
      r.check_in_ip || '—',
      r.network_verified ? 'Yes' : 'No',
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Attendance_${dateFrom}_${dateTo}.csv`; a.click();
  };

  // Group by date
  const groupedByDate = records.reduce((acc: Record<string, typeof records>, rec) => {
    if (!acc[rec.date]) acc[rec.date] = [];
    acc[rec.date].push(rec);
    return acc;
  }, {});
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  if (profile?.role !== 'admin' && profile?.role !== 'manager') {
    return (
      <AppLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--text-muted)' }}>
          ⛔ Access restricted to admins and managers.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                📋 Attendance Report
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                Track team check-in and check-out records
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="date"
                className="form-input"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                style={{ fontSize: '13px', padding: '8px 12px' }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>to</span>
              <input
                type="date"
                className="form-input"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                style={{ fontSize: '13px', padding: '8px 12px' }}
              />
              <button className="btn btn-secondary" onClick={exportCSV} title="Export to CSV">
                📥 Export CSV
              </button>
            </div>
          </div>
        </motion.div>

        {/* Summary Stats */}
        {summary && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}
          >
            {[
              { label: 'Total Records', value: summary.total_records, icon: '📋', color: '#7c3aed' },
              { label: 'Checked Out', value: summary.checked_out, icon: '✅', color: '#22c55e' },
              { label: 'Still In', value: summary.still_in, icon: '🟢', color: '#3b82f6' },
              { label: 'Avg Hours', value: `${summary.avg_hours}h`, icon: '⏱️', color: '#f59e0b' },
            ].map(stat => (
              <div
                key={stat.label}
                style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${stat.color}30`,
                  borderRadius: '14px',
                  padding: '18px 20px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '18px' }}>{stat.icon}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Records Table */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div className="spinner" />
          </div>
        ) : records.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px',
            background: 'var(--bg-card)', borderRadius: '16px',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)', fontSize: '14px',
          }}>
            📭 No attendance records found for this date range.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {sortedDates.map((date, dIdx) => {
              const dayRecords = groupedByDate[date];
              const dayLabel = new Date(date + 'T00:00:00').toLocaleDateString([], {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              });

              return (
                <motion.div
                  key={date}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: dIdx * 0.07 }}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                  }}
                >
                  {/* Date header */}
                  <div style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border)',
                    background: 'rgba(124,58,237,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>{dayLabel}</span>
                    <span style={{
                      fontSize: '12px', fontWeight: 600, color: '#7c3aed',
                      background: 'rgba(124,58,237,0.12)', padding: '3px 10px',
                      borderRadius: '999px', border: '1px solid rgba(124,58,237,0.25)',
                    }}>
                      {dayRecords.length} {dayRecords.length === 1 ? 'record' : 'records'}
                    </span>
                  </div>

                  {/* Table */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Employee', 'Check In', 'Check Out', 'Duration', 'Network', 'IP Address'].map(col => (
                            <th key={col} style={{
                              padding: '10px 16px', textAlign: 'left',
                              fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)',
                              textTransform: 'uppercase', letterSpacing: '0.05em',
                            }}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dayRecords.map((rec, i) => {
                          const complete = !!rec.check_in_time && !!rec.check_out_time;
                          const partial = !!rec.check_in_time && !rec.check_out_time;
                          const initials = rec.user?.full_name
                            ? rec.user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                            : '??';

                          return (
                            <tr
                              key={rec.id}
                              style={{
                                borderBottom: i < dayRecords.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                transition: 'background 0.15s',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              {/* Employee */}
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{
                                    width: '32px', height: '32px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0,
                                  }}>
                                    {initials}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{rec.user?.full_name || 'Unknown'}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{rec.user?.job_title || rec.user?.role || ''}</div>
                                  </div>
                                </div>
                              </td>
                              {/* Check In */}
                              <td style={{ padding: '12px 16px', fontSize: '13px', color: '#22c55e', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                {formatTime(rec.check_in_time)}
                              </td>
                              {/* Check Out */}
                              <td style={{ padding: '12px 16px', fontSize: '13px', color: rec.check_out_time ? '#f87171' : 'var(--text-muted)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                {formatTime(rec.check_out_time)}
                              </td>
                              {/* Duration */}
                              <td style={{ padding: '12px 16px', fontSize: '13px', color: complete ? 'var(--text-primary)' : '#3b82f6', fontWeight: 600 }}>
                                {formatDuration(rec.check_in_time, rec.check_out_time)}
                              </td>
                              {/* Network */}
                              <td style={{ padding: '12px 16px' }}>
                                <span style={{
                                  fontSize: '11px', fontWeight: 600,
                                  color: rec.network_verified ? '#22c55e' : '#f87171',
                                  background: rec.network_verified ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                  padding: '3px 9px', borderRadius: '999px',
                                  border: `1px solid ${rec.network_verified ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                                }}>
                                  {rec.network_verified ? '✅ Verified' : '❌ Unverified'}
                                </span>
                              </td>
                              {/* IP */}
                              <td style={{ padding: '12px 16px' }}>
                                <code style={{
                                  fontSize: '11px', color: 'var(--text-muted)',
                                  background: 'rgba(255,255,255,0.05)',
                                  padding: '2px 8px', borderRadius: '4px',
                                }}>
                                  {rec.check_in_ip || '—'}
                                </code>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

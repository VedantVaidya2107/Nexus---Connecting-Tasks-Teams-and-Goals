'use client';

import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { AttendanceRecord } from '@/lib/types';
import toast from 'react-hot-toast';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDuration(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn) return '—';
  const end = checkOut ? new Date(checkOut) : new Date();
  const ms = end.getTime() - new Date(checkIn).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString([], { weekday: 'short' });
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface NetworkInfo {
  on_network: boolean;
  client_ip: string;
  network_name: string;
  configured: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const { user } = useAuth();
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [liveTime, setLiveTime] = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchAttendance = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/today?user_id=${user.id}`);
      const data = await res.json();
      if (data.success) {
        setTodayRecord(data.today);
        setHistory(data.history || []);
        setNetwork(data.network);
      }
    } catch {
      toast.error('Failed to load attendance data.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const handleCheckIn = async () => {
    if (!user?.id) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        await fetchAttendance();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Check-in failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!user?.id) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        await fetchAttendance();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('Check-out failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Derive state
  const isCheckedIn = !!todayRecord?.check_in_time && !todayRecord?.check_out_time;
  const isCheckedOut = !!todayRecord?.check_in_time && !!todayRecord?.check_out_time;
  const canAct = network?.on_network && network?.configured;

  // Status config
  const statusConfig = isCheckedOut
    ? { label: 'Day Complete', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', icon: '✅' }
    : isCheckedIn
    ? { label: 'Checked In', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', icon: '🟢' }
    : { label: 'Not Checked In', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', icon: '⚪' };

  const today = new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  if (loading) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div className="spinner" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 24px' }}>

      {/* Page Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            👆 Attendance
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>{today}</p>
        </div>
      </motion.div>

      {/* Network Status Banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          border: `1px solid ${canAct ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          background: canAct ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
        }}
      >
        <div style={{ fontSize: '20px' }}>{canAct ? '📶' : '🚫'}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '14px', color: canAct ? '#22c55e' : '#f87171' }}>
            {!network?.configured
              ? 'Network not configured — contact your admin'
              : canAct
              ? `Connected to ${network.network_name} — Check In/Out enabled`
              : `Not on ${network?.network_name || 'Office Network'} — Check In/Out disabled`}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Your IP: <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '4px', fontSize: '11px' }}>{network?.client_ip || '—'}</code>
          </div>
        </div>
        {/* Animated pulse dot */}
        {canAct && (
          <div style={{ position: 'relative', width: '10px', height: '10px' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#22c55e', animation: 'ping 1.5s infinite' }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#22c55e' }} />
          </div>
        )}
      </motion.div>

      {/* Main Clock + Check In/Out Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '20px',
          padding: '40px 32px',
          textAlign: 'center',
          marginBottom: '24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: isCheckedIn
            ? 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.12) 0%, transparent 70%)'
            : isCheckedOut
            ? 'radial-gradient(ellipse at 50% 0%, rgba(34,197,94,0.1) 0%, transparent 70%)'
            : 'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.08) 0%, transparent 70%)',
        }} />

        {/* Live Clock */}
        <div style={{ fontSize: '52px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-2px', lineHeight: 1, marginBottom: '4px', fontVariantNumeric: 'tabular-nums' }}>
          {liveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '28px' }}>
          {liveTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
        </div>

        {/* Status Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: statusConfig.bg,
          border: `1px solid ${statusConfig.color}40`,
          borderRadius: '999px',
          padding: '6px 18px',
          marginBottom: '32px',
          fontSize: '13px', fontWeight: 600, color: statusConfig.color,
        }}>
          {statusConfig.icon} {statusConfig.label}
        </div>

        {/* Time Summary Row */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '36px' }}>
          {[
            { label: 'Check In', value: formatTime(todayRecord?.check_in_time ?? null), icon: '🟢' },
            { label: 'Duration', value: formatDuration(todayRecord?.check_in_time ?? null, todayRecord?.check_out_time ?? null), icon: '⏱️' },
            { label: 'Check Out', value: formatTime(todayRecord?.check_out_time ?? null), icon: '🔴' },
          ].map(item => (
            <div key={item.label} style={{
              flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '12px',
              padding: '14px 12px', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize: '18px', marginBottom: '4px' }}>{item.icon}</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{item.value}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* Action Button */}
        <AnimatePresence mode="wait">
          {isCheckedOut ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '10px', padding: '16px 32px',
                background: 'rgba(34,197,94,0.12)', borderRadius: '14px',
                border: '1px solid rgba(34,197,94,0.3)',
                color: '#22c55e', fontWeight: 700, fontSize: '16px',
              }}
            >
              ✅ Great work today! See you tomorrow.
            </motion.div>
          ) : isCheckedIn ? (
            <motion.button
              key="checkout"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={handleCheckOut}
              disabled={actionLoading || !canAct}
              style={{
                width: '100%', padding: '18px', fontSize: '17px', fontWeight: 700,
                border: 'none', borderRadius: '14px', cursor: canAct ? 'pointer' : 'not-allowed',
                background: canAct
                  ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                  : 'rgba(148,163,184,0.15)',
                color: canAct ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s',
                boxShadow: canAct ? '0 8px 24px rgba(239,68,68,0.35)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              }}
            >
              {actionLoading ? (
                <><span className="spinner" style={{ width: '18px', height: '18px' }} /> Checking Out...</>
              ) : (
                <>🔴 Check Out</>
              )}
            </motion.button>
          ) : (
            <motion.button
              key="checkin"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={handleCheckIn}
              disabled={actionLoading || !canAct}
              style={{
                width: '100%', padding: '18px', fontSize: '17px', fontWeight: 700,
                border: 'none', borderRadius: '14px', cursor: canAct ? 'pointer' : 'not-allowed',
                background: canAct
                  ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
                  : 'rgba(148,163,184,0.15)',
                color: canAct ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s',
                boxShadow: canAct ? '0 8px 24px rgba(124,58,237,0.4)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              }}
            >
              {actionLoading ? (
                <><span className="spinner" style={{ width: '18px', height: '18px' }} /> Checking In...</>
              ) : (
                <>🟢 Check In</>
              )}
            </motion.button>
          )}
        </AnimatePresence>

        {!canAct && !isCheckedOut && (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
            {!network?.configured
              ? '⚠️ Admin needs to configure office network IPs in Settings → WiFi Security'
              : '⚠️ Connect to the office WiFi to enable check in/out'}
          </p>
        )}
      </motion.div>

      {/* Weekly History */}
      {history.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '24px',
          }}
        >
          <h3 style={{ margin: '0 0 18px', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
            📅 This Week
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {history.map((rec, i) => {
              const duration = formatDuration(rec.check_in_time, rec.check_out_time);
              const complete = !!rec.check_in_time && !!rec.check_out_time;
              const partial = !!rec.check_in_time && !rec.check_out_time;
              const dotColor = complete ? '#22c55e' : partial ? '#3b82f6' : '#475569';

              return (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  {/* Day */}
                  <div style={{ width: '38px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{getDayOfWeek(rec.date)}</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{new Date(rec.date + 'T00:00:00').getDate()}</div>
                  </div>

                  <div style={{ width: '1px', height: '32px', background: 'var(--border)' }} />

                  {/* Status dot */}
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {formatTime(rec.check_in_time)} — {formatTime(rec.check_out_time)}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {complete ? `${duration} worked` : partial ? 'Still checked in' : 'Absent'}
                    </div>
                  </div>

                  <div style={{
                    fontSize: '13px', fontWeight: 700,
                    color: complete ? '#22c55e' : partial ? '#3b82f6' : '#475569',
                  }}>
                    {complete ? duration : partial ? 'In progress' : '—'}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Ping animation */}
      <style>{`
        @keyframes ping {
          0% { transform: scale(1); opacity: 1; }
          75%, 100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
    </AppLayout>
  );
}

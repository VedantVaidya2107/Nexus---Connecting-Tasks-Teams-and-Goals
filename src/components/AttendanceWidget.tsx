'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AttendanceRecord } from '@/lib/types';
import toast from 'react-hot-toast';

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

interface NetworkInfo {
  on_network: boolean;
  network_name: string;
  configured: boolean;
  client_ip: string;
}

export default function AttendanceWidget() {
  const { user } = useAuth();
  const router = useRouter();
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [liveTime, setLiveTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/attendance/today?user_id=${user.id}`);
      const data = await res.json();
      if (data.success) {
        setRecord(data.today);
        setNetwork(data.network);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCheckIn = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      if (data.success) { toast.success('Checked in! 🟢'); await fetchData(); }
      else toast.error(data.message);
    } catch { toast.error('Check-in failed.'); }
    finally { setActionLoading(false); }
  };

  const handleCheckOut = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      if (data.success) { toast.success('Checked out! 🔴'); await fetchData(); }
      else toast.error(data.message);
    } catch { toast.error('Check-out failed.'); }
    finally { setActionLoading(false); }
  };

  const isCheckedIn = !!record?.check_in_time && !record?.check_out_time;
  const isCheckedOut = !!record?.check_in_time && !!record?.check_out_time;
  const canAct = network?.on_network && network?.configured;

  const accentColor = isCheckedOut ? '#22c55e' : isCheckedIn ? '#3b82f6' : '#7c3aed';
  const statusLabel = isCheckedOut ? 'Day Complete' : isCheckedIn ? 'Checked In' : 'Not Checked In';
  const statusIcon = isCheckedOut ? '✅' : isCheckedIn ? '🟢' : '⚪';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      onClick={() => router.push('/attendance')}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${accentColor}30`,
        borderRadius: '16px',
        padding: '20px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      whileHover={{ boxShadow: `0 8px 32px ${accentColor}20` }}
    >
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '120px', height: '120px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${accentColor}18 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>👆</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>ATTENDANCE</span>
        </div>
        <div style={{
          fontSize: '11px', fontWeight: 600,
          color: accentColor,
          background: `${accentColor}15`,
          padding: '3px 10px', borderRadius: '999px',
          border: `1px solid ${accentColor}30`,
        }}>
          {statusIcon} {statusLabel}
        </div>
      </div>

      {/* Live time */}
      <div style={{
        fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)',
        letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
        marginBottom: '12px',
      }}>
        {liveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>In</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatTime(record?.check_in_time ?? null)}</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Duration</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatDuration(record?.check_in_time ?? null, record?.check_out_time ?? null)}</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Out</div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatTime(record?.check_out_time ?? null)}</div>
        </div>
      </div>

      {/* Network status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: '11px',
        color: canAct ? '#22c55e' : '#f87171',
        marginBottom: '12px',
      }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: canAct ? '#22c55e' : '#f87171' }} />
        {canAct ? `${network?.network_name} detected` : 'Not on office network'}
      </div>

      {/* Action button */}
      {loading ? null : isCheckedOut ? (
        <div style={{
          textAlign: 'center', fontSize: '13px', color: '#22c55e',
          fontWeight: 600, padding: '10px',
          background: 'rgba(34,197,94,0.08)', borderRadius: '10px',
        }}>
          ✅ Done for today
        </div>
      ) : (
        <button
          onClick={isCheckedIn ? handleCheckOut : handleCheckIn}
          disabled={actionLoading || !canAct}
          style={{
            width: '100%', padding: '11px', fontSize: '13px', fontWeight: 700,
            border: 'none', borderRadius: '10px', cursor: canAct ? 'pointer' : 'not-allowed',
            background: canAct
              ? isCheckedIn
                ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                : 'linear-gradient(135deg, #7c3aed, #6d28d9)'
              : 'rgba(148,163,184,0.1)',
            color: canAct ? '#fff' : 'var(--text-muted)',
            transition: 'opacity 0.2s',
          }}
        >
          {actionLoading
            ? 'Please wait...'
            : isCheckedIn
            ? '🔴 Check Out'
            : '🟢 Check In'}
        </button>
      )}
    </motion.div>
  );
}

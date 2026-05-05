'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Notification } from '@/lib/types';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => { if (data) setNotifications(data as Notification[]); });
  }, [user]);

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <header className="header">
      <div className="header-left">
        <div>
          <h2>{title}</h2>
          {subtitle && <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</p>}
        </div>
      </div>
      <div className="header-right">
        <div className="search-bar">
          <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>🔍</span>
          <input
            type="text"
            placeholder="Search tasks, projects..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="icon-btn" onClick={() => setShowNotifs(!showNotifs)}>
          🔔
          {notifications.length > 0 && <span className="dot" />}
        </button>

        {showNotifs && (
          <div style={{
            position: 'absolute', top: '56px', right: '32px',
            width: '340px', background: 'var(--bg-secondary)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)', zIndex: 200, maxHeight: '400px', overflowY: 'auto',
          }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: '14px' }}>
              Notifications ({notifications.length})
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                All caught up! ✨
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} style={{
                  padding: '12px 16px', borderBottom: '1px solid var(--border)',
                  cursor: 'pointer', transition: 'background 0.15s',
                }} onClick={() => markRead(n.id)}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{n.title}</div>
                  {n.message && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{n.message}</div>}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </header>
  );
}

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
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setTheme('light');
      document.documentElement.classList.add('light-mode');
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleTheme = () => {
    if (theme === 'dark') {
      setTheme('light');
      document.documentElement.classList.add('light-mode');
      localStorage.setItem('theme', 'light');
    } else {
      setTheme('dark');
      document.documentElement.classList.remove('light-mode');
      localStorage.setItem('theme', 'dark');
    }
  };

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
    <header className={`header ${isScrolled ? 'scrolled' : ''}`} style={isScrolled ? { background: 'rgba(8, 13, 26, 0.9)', borderBottom: '1px solid rgba(124, 58, 237, 0.2)' } : { transition: 'all 0.3s ease' }}>
      <div className="header-left">
        <div>
          <h2 className="page-title">{title}</h2>
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
        
        <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
          + New Task
        </button>

        <button className="icon-btn" onClick={toggleTheme} title="Toggle Theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className={`icon-btn ${notifications.length > 0 ? 'has-alerts' : ''}`} onClick={() => setShowNotifs(!showNotifs)}>
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

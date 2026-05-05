'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const NAV_ITEMS = [
  { section: 'Main', items: [
    { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    { label: 'My Tasks', href: '/my-tasks', icon: '✅' },
    { label: 'All Tasks', href: '/tasks', icon: '📋' },
    { label: 'Projects', href: '/projects', icon: '📁' },
  ]},
  { section: 'Collaborate', items: [
    { label: 'Team', href: '/team', icon: '👥' },
    { label: 'Calendar', href: '/calendar', icon: '📅' },
    { label: 'Standup', href: '/standup', icon: '🎯' },
  ]},
  { section: 'Manage', items: [
    { label: 'Reports', href: '/reports', icon: '📈' },
    { label: 'Settings', href: '/settings', icon: '⚙️' },
  ]},
  { section: 'Admin', items: [
    { label: 'Team Management', href: '/team/manage', icon: '🛡️' },
  ]},
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">N</div>
        <div>
          <h1>Nexus</h1>
          <span>Connecting tasks, teams, and goals</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.filter(s => s.section !== 'Admin' || profile?.role === 'admin').map(section => (
          <div key={section.section} className="nav-section">
            <div className="nav-section-label">{section.section}</div>
            {section.items.map(item => (
              <button
                key={item.href}
                className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                onClick={() => router.push(item.href)}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="name">{profile?.full_name || 'Loading...'}</div>
            <div className="role">{profile?.role?.replace('_', ' ') || ''}</div>
          </div>
          <button className="btn-ghost btn-sm" onClick={signOut} title="Sign Out">🚪</button>
        </div>
      </div>
    </aside>
  );
}

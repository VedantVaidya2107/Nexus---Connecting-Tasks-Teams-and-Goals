'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/lib/supabase';
import { TASK_PRIORITY_CONFIG } from '@/lib/types';
import type { Task } from '@/lib/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    const { data } = await supabase.from('tasks').select('*').not('due_date', 'is', null);
    if (data) setTasks(data as Task[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toDateString();

  const cells: { day: number; isCurrentMonth: boolean; date: string }[] = [];
  // Prev month
  const prevDays = new Date(year, month, 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevDays - i;
    cells.push({ day: d, isCurrentMonth: false, date: new Date(year, month - 1, d).toISOString().split('T')[0] });
  }
  // Current
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, isCurrentMonth: true, date: new Date(year, month, d).toISOString().split('T')[0] });
  }
  // Next
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, isCurrentMonth: false, date: new Date(year, month + 1, d).toISOString().split('T')[0] });
  }

  const nav = (dir: number) => setCurrentDate(new Date(year, month + dir, 1));

  if (loading) return <AppLayout><div className="loading-page"><div className="spinner" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="page-header">
        <div><h1>Calendar</h1><div className="subtitle">Task deadlines overview</div></div>
        <div className="page-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => nav(-1)}>← Prev</button>
          <span style={{ fontWeight: 700, fontSize: '16px', minWidth: '160px', textAlign: 'center' }}>
            {currentDate.toLocaleDateString('en', { month: 'long', year: 'numeric' })}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={() => nav(1)}>Next →</button>
        </div>
      </div>

      <div className="calendar-grid">
        {DAYS.map(d => <div key={d} className="calendar-header-cell">{d}</div>)}
        {cells.map((cell, i) => {
          const dayTasks = tasks.filter(t => t.due_date === cell.date);
          const isToday = new Date(cell.date).toDateString() === today;
          return (
            <div key={i} className={`calendar-cell ${!cell.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}>
              <div className="day-number">{cell.day}</div>
              {dayTasks.slice(0, 3).map(t => (
                <div key={t.id} className="calendar-event" style={{ background: TASK_PRIORITY_CONFIG[t.priority].bg, color: TASK_PRIORITY_CONFIG[t.priority].color }}>
                  {t.title}
                </div>
              ))}
              {dayTasks.length > 3 && <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px 6px' }}>+{dayTasks.length - 3} more</div>}
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}

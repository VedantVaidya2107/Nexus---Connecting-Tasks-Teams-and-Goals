'use client';

import React, { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { DailyUpdate, Profile, Task, Project } from '@/lib/types';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function StandupPage() {
  const { user, profile } = useAuth();
  const [updates, setUpdates] = useState<(DailyUpdate & { user?: Profile })[]>([]);
  const [myUpdate, setMyUpdate] = useState<DailyUpdate | null>(null);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [yesterday, setYesterday] = useState('');
  const [today, setToday] = useState('');
  const [blockers, setBlockers] = useState('');
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [projectFilter, setProjectFilter] = useState('all');

  const [isRecording, setIsRecording] = useState(false);
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = 'en-US';

        let fullTranscript = '';

        rec.onresult = (event: any) => {
          const result = event.results[event.results.length - 1];
          if (result.isFinal) {
            fullTranscript += ' ' + result[0].transcript;
          }
        };

        rec.onend = async () => {
          setIsRecording(false);
          if (fullTranscript.trim()) {
            await parseSpeechWithAI(fullTranscript.trim());
          }
        };

        rec.onerror = (e: any) => {
          console.error('Speech recognition error', e);
          setIsRecording(false);
          toast.error('Voice typing failed: ' + (e.error || 'unknown error'));
        };

        setRecognition(rec);
      }
    }
  }, []);

  const toggleVoiceTyping = () => {
    if (!recognition) {
      toast.error('Voice typing is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (isRecording) {
      recognition.stop();
    } else {
      setIsRecording(true);
      toast.success('Speak your daily update naturally! Click button again to finish.');
      recognition.start();
    }
  };

  const parseSpeechWithAI = async (transcript: string) => {
    setIsAiParsing(true);
    const loadingToast = toast.loading('AI is structuring your speech...');
    try {
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token || '';

      const res = await fetch('/api/ai/parse-standup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ transcript })
      });

      const result = await res.json();
      toast.dismiss(loadingToast);

      if (result.success && result.data) {
        setYesterday(result.data.yesterday);
        setToday(result.data.today);
        setBlockers(result.data.blockers);
        toast.success('AI parsed and filled out your update!');
      } else {
        toast.error(result.error || 'Failed to parse your update. Please speak again.');
      }
    } catch (e: any) {
      toast.dismiss(loadingToast);
      console.error(e);
      toast.error('Failed to communicate with AI endpoint.');
    } finally {
      setIsAiParsing(false);
    }
  };

  const fetchData = useCallback(async () => {
    if (!profile) return;

    let updatesQuery = supabase.from('daily_updates').select('*, user:profiles(*)').eq('date', selectedDate).order('created_at');
    
    // Privacy: Members only see their own updates
    if (profile.role === 'team_member') {
      updatesQuery = updatesQuery.eq('user_id', user?.id);
    }

    const [allRes, myRes, tasksRes, projectsRes] = await Promise.all([
      updatesQuery,
      user ? supabase.from('daily_updates').select('*').eq('user_id', user.id).eq('date', selectedDate).maybeSingle() : Promise.resolve({ data: null }),
      user ? supabase.from('tasks').select('*').eq('assignee_id', user.id).in('status', ['pending', 'in_progress', 'awaiting_zoho', 'awaiting_client', 'awaiting_team']) : Promise.resolve({ data: null }),
      supabase.from('projects').select('*'),
    ]);
    if (allRes.data) setUpdates(allRes.data as (DailyUpdate & { user?: Profile })[]);
    if (projectsRes.data) setProjects(projectsRes.data as Project[]);
    if (myRes.data) {
      const mu = myRes.data as DailyUpdate;
      setMyUpdate(mu);
      
      const cy = mu.completed_yesterday || '';
      const match = cy.match(/^<!--project:({.*?})-->/);
      if (match) {
        try {
          const projInfo = JSON.parse(match[1]);
          setSelectedProject(projInfo.id || '');
          setYesterday(cy.replace(match[0], ''));
        } catch (e) {
          setSelectedProject('');
          setYesterday(cy);
        }
      } else {
        setSelectedProject('');
        setYesterday(cy);
      }
      
      setToday(mu.planned_today || '');
      setBlockers(mu.blockers || '');
    } else {
      setMyUpdate(null);
      setYesterday('');
      setToday('');
      setBlockers('');
      setSelectedProject('');
    }
    if (tasksRes.data) {
      setMyTasks(tasksRes.data as Task[]);
    }
    setLoading(false);
  }, [user, profile, selectedDate]);

  useEffect(() => { 
    if (profile) fetchData(); 
  }, [fetchData, profile]);

  const saveUpdate = async () => {
    let finalYesterday = yesterday;
    if (selectedProject) {
      const proj = projects.find(p => p.id === selectedProject);
      if (proj) {
        const metadata = JSON.stringify({ id: proj.id, name: proj.name });
        finalYesterday = `<!--project:${metadata}-->${yesterday}`;
      }
    }

    const payload = { user_id: user!.id, date: selectedDate, completed_yesterday: finalYesterday, planned_today: today, blockers };
    if (myUpdate) {
      await supabase.from('daily_updates').update(payload).eq('id', myUpdate.id);
    } else {
      await supabase.from('daily_updates').insert(payload);
    }
    toast.success('Standup saved!');
    fetchData();
  };

  if (loading) return <AppLayout><div className="loading-page"><div className="spinner" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1>Daily Standup</h1>
          <div className="subtitle">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label htmlFor="standupDate" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Select Date:</label>
          <input 
            id="standupDate"
            type="date" 
            className="form-input" 
            style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', marginBottom: 0 }} 
            value={selectedDate} 
            onChange={e => setSelectedDate(e.target.value)} 
          />
        </div>
      </div>

      {/* My Update Form */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ padding: '28px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>📝 Your Update {myUpdate ? '(Saved ✓)' : ''}</h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label htmlFor="standupProject" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Project:</label>
              <select 
                id="standupProject"
                className="form-select" 
                style={{ width: 'auto', padding: '4px 10px', fontSize: '12px', height: '32px' }} 
                value={selectedProject} 
                onChange={e => setSelectedProject(e.target.value)}
              >
                <option value="">No Project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <button 
              type="button"
              className={`btn ${isRecording ? 'btn-danger pulse' : 'btn-secondary'}`}
              onClick={toggleVoiceTyping}
              disabled={isAiParsing}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                padding: '6px 14px', 
                fontSize: '13px',
                borderRadius: '20px',
                border: isRecording ? 'none' : '1px solid var(--border)',
                background: isRecording ? 'var(--red)' : 'var(--bg-hover)',
                color: isRecording ? '#fff' : 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                height: '32px'
              }}
            >
              {isRecording ? (
                <>
                  <span className="live-dot" /> 
                  Stop Recording...
                </>
              ) : isAiParsing ? (
                <>
                  <div className="spinner-sm" /> 
                  AI parsing...
                </>
              ) : (
                <>🎙️ AI Voice Standup</>
              )}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="compYesterday" className="form-label">✅ What did you complete yesterday?</label>
          <textarea id="compYesterday" className="form-textarea" value={yesterday} onChange={e => setYesterday(e.target.value)} placeholder="List your completions..." style={{ minHeight: '80px' }} />
        </div>
        <div className="form-group">
          <label htmlFor="planToday" className="form-label">🎯 What are you working on today?</label>
          {myTasks.length > 0 && (
            <div style={{ marginBottom: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>Suggested from your pending tasks:</span>
              {myTasks.map(t => (
                <button 
                  key={t.id} 
                  type="button"
                  onClick={() => setToday(prev => prev ? `${prev}\n- ${t.title}` : `- ${t.title}`)}
                  className="btn-ghost btn-sm" 
                  style={{ padding: '2px 8px', fontSize: '11px', background: 'var(--bg-hover)', border: '1px dashed var(--border)' }}
                >
                  + {t.title}
                </button>
              ))}
            </div>
          )}
          <textarea id="planToday" className="form-textarea" value={today} onChange={e => setToday(e.target.value)} placeholder="List your plans..." style={{ minHeight: '80px' }} />
        </div>
        <div className="form-group">
          <label htmlFor="anyBlockers" className="form-label">🚧 Any blockers?</label>
          <textarea id="anyBlockers" className="form-textarea" value={blockers} onChange={e => setBlockers(e.target.value)} placeholder="Describe blockers or type 'None'" style={{ minHeight: '60px' }} />
        </div>
        <button className="btn btn-primary" onClick={saveUpdate}>{myUpdate ? 'Update' : 'Submit'}</button>
      </motion.div>

      {/* Team Updates */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Team Updates ({updates.length})</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="projectFilterSelect" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Filter by Project:</label>
          <select 
            id="projectFilterSelect"
            className="form-select" 
            style={{ width: 'auto', padding: '4px 10px', fontSize: '12px', height: '32px' }} 
            value={projectFilter} 
            onChange={e => setProjectFilter(e.target.value)}
          >
            <option value="all">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      {updates.length === 0 ? (
        <motion.div className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <motion.div className="empty-icon" animate={{ y: [0, -10, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>🎯</motion.div>
          <h3>No updates yet today</h3>
          <p>Be the first to share your standup!</p>
        </motion.div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {updates.map((u, index) => {
            // Parse project tag if present
            let yesterdayText = u.completed_yesterday || '';
            let parsedProject: { id: string; name: string } | null = null;
            const match = yesterdayText.match(/^<!--project:({.*?})-->/);
            if (match) {
              try {
                parsedProject = JSON.parse(match[1]);
                yesterdayText = yesterdayText.replace(match[0], '');
              } catch (e) {}
            }

            // Filter by project if filter is active
            if (projectFilter !== 'all' && parsedProject?.id !== projectFilter) {
              return null;
            }

            return (
              <motion.div 
                key={u.id} 
                className="glass-card" 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1, duration: 0.4 }}
                style={{ padding: '20px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="user-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>{u.user?.full_name?.[0] || '?'}</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{u.user?.full_name || 'Unknown'}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(u.created_at).toLocaleTimeString()}</div>
                    </div>
                  </div>
                  {parsedProject && (
                    <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                      📁 {parsedProject.name}
                    </span>
                  )}
                </div>
                {yesterdayText && <div style={{ marginBottom: '10px' }}><strong style={{ fontSize: '12px', color: 'var(--green)' }}>YESTERDAY:</strong><p style={{ fontSize: '13px', marginTop: '4px', lineHeight: 1.5 }}>{yesterdayText}</p></div>}
                {u.planned_today && <div style={{ marginBottom: '10px' }}><strong style={{ fontSize: '12px', color: 'var(--blue)' }}>TODAY:</strong><p style={{ fontSize: '13px', marginTop: '4px', lineHeight: 1.5 }}>{u.planned_today}</p></div>}
                {u.blockers && u.blockers.toLowerCase() !== 'none' && <div><strong style={{ fontSize: '12px', color: 'var(--red)' }}>BLOCKERS:</strong><p style={{ fontSize: '13px', marginTop: '4px', lineHeight: 1.5 }}>{u.blockers}</p></div>}
              </motion.div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}

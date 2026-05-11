'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import AIAssistant from '@/components/AIAssistant';
import DynamicBackground from '@/components/DynamicBackground';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;
  if (!user) return null;

  return (
    <div className="app-layout">
      <DynamicBackground />
      <Sidebar />
      <Header title="Dashboard" />
      <main className="main-content">
        {children}
      </main>
      <AIAssistant />
    </div>
  );
}

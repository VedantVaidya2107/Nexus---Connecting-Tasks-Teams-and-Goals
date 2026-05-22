import { NextResponse } from 'next/server';

const SQL = `-- ============================================
-- Time Entries Table Migration (Full)
-- Run this in your Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  description TEXT,
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_billable BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add is_billable if table already exists (safe to run twice)
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS is_billable BOOLEAN NOT NULL DEFAULT TRUE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_logged_date ON time_entries(logged_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_is_billable ON time_entries(is_billable);

-- RLS
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own time entries" ON time_entries;
CREATE POLICY "Users can manage own time entries"
  ON time_entries FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins managers can view all time entries" ON time_entries;
CREATE POLICY "Admins managers can view all time entries"
  ON time_entries FOR SELECT
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager'));

DROP POLICY IF EXISTS "Admins managers can insert time entries" ON time_entries;
CREATE POLICY "Admins managers can insert time entries"
  ON time_entries FOR INSERT
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager')
    OR auth.uid() = user_id
  );
`;

export async function GET() {
  return new NextResponse(SQL, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'inline; filename="time_entries_migration.sql"',
    },
  });
}

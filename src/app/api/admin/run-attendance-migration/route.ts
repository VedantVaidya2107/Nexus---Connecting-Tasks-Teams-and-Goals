import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * One-time migration endpoint to create attendance tables.
 * Call this ONCE via: POST /api/admin/run-attendance-migration
 */
export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ success: false, message: 'Missing environment variables.' }, { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  const migrations = [
    // WiFi settings table
    `CREATE TABLE IF NOT EXISTS wifi_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      network_name text NOT NULL DEFAULT 'Office Network',
      allowed_ips text[] NOT NULL DEFAULT '{}',
      is_active boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`,

    // Attendance records table
    `CREATE TABLE IF NOT EXISTS attendance_records (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      date date NOT NULL DEFAULT CURRENT_DATE,
      check_in_time timestamptz,
      check_out_time timestamptz,
      check_in_ip text,
      check_out_ip text,
      network_verified boolean DEFAULT false,
      notes text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      UNIQUE(user_id, date)
    )`,

    // Enable RLS
    `ALTER TABLE wifi_settings ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY`,

    // RLS policies for attendance_records
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'attendance_records' AND policyname = 'Users can manage own attendance'
      ) THEN
        CREATE POLICY "Users can manage own attendance" ON attendance_records
          FOR ALL USING (auth.uid() = user_id);
      END IF;
    END $$`,

    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'attendance_records' AND policyname = 'Admins can view all attendance'
      ) THEN
        CREATE POLICY "Admins can view all attendance" ON attendance_records
          FOR SELECT USING (
            EXISTS (
              SELECT 1 FROM profiles
              WHERE id = auth.uid() AND role IN ('admin', 'manager')
            )
          );
      END IF;
    END $$`,

    // RLS policies for wifi_settings
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'wifi_settings' AND policyname = 'Admins can manage wifi settings'
      ) THEN
        CREATE POLICY "Admins can manage wifi settings" ON wifi_settings
          FOR ALL USING (
            EXISTS (
              SELECT 1 FROM profiles
              WHERE id = auth.uid() AND role IN ('admin', 'manager')
            )
          );
      END IF;
    END $$`,

    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'wifi_settings' AND policyname = 'Authenticated users can read wifi settings'
      ) THEN
        CREATE POLICY "Authenticated users can read wifi settings" ON wifi_settings
          FOR SELECT USING (auth.uid() IS NOT NULL);
      END IF;
    END $$`,

    // Seed default wifi_settings row
    `INSERT INTO wifi_settings (network_name, allowed_ips)
     SELECT 'Office Network', ARRAY[]::text[]
     WHERE NOT EXISTS (SELECT 1 FROM wifi_settings)`,
  ];

  const results: { sql: string; success: boolean; error?: string }[] = [];

  for (const sql of migrations) {
    try {
      const { error } = await supabaseAdmin.rpc('exec_sql', { query: sql }).single();
      if (error) {
        // Try a direct PostgreSQL REST API call
        const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey,
          },
          body: JSON.stringify({ query: sql }),
        });
        if (!resp.ok) {
          results.push({ sql: sql.slice(0, 80) + '...', success: false, error: `HTTP ${resp.status}` });
        } else {
          results.push({ sql: sql.slice(0, 80) + '...', success: true });
        }
      } else {
        results.push({ sql: sql.slice(0, 80) + '...', success: true });
      }
    } catch (err: any) {
      results.push({ sql: sql.slice(0, 80) + '...', success: false, error: err.message });
    }
  }

  const allOk = results.every(r => r.success);

  return NextResponse.json({
    success: allOk,
    message: allOk
      ? '✅ All attendance tables created successfully!'
      : '⚠️ Some migrations failed — check results. You may need to run the SQL manually.',
    results,
    manual_sql_fallback: !allOk
      ? 'Run the SQL from: supabase/migrations/20260526_attendance.sql in your Supabase SQL Editor'
      : null,
  });
}

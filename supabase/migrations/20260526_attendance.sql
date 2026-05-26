-- =====================================================
-- Attendance Records Table
-- =====================================================
CREATE TABLE IF NOT EXISTS attendance_records (
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
);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- Users can manage their own records
CREATE POLICY "Users can manage own attendance" ON attendance_records
  FOR ALL USING (auth.uid() = user_id);

-- Admins and managers can view all records
CREATE POLICY "Admins can view all attendance" ON attendance_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- =====================================================
-- WiFi Settings Table
-- =====================================================
CREATE TABLE IF NOT EXISTS wifi_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_name text NOT NULL DEFAULT 'Office Network',
  allowed_ips text[] NOT NULL DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wifi_settings ENABLE ROW LEVEL SECURITY;

-- Only admins and managers can manage wifi settings
CREATE POLICY "Admins can manage wifi settings" ON wifi_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- All authenticated users can read wifi settings (needed for check-in validation)
CREATE POLICY "Authenticated users can read wifi settings" ON wifi_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Seed default row
INSERT INTO wifi_settings (network_name, allowed_ips)
SELECT 'Office Network', ARRAY[]::text[]
WHERE NOT EXISTS (SELECT 1 FROM wifi_settings);

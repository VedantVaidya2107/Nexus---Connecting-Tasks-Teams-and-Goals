import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null as any;

export async function GET() {
  const results: string[] = [];

  // Step 1: Try to create the table (ignore if exists)
  try {
    // Check if time_entries table exists by querying it
    const { error: checkError } = await supabaseAdmin
      .from('time_entries')
      .select('id')
      .limit(1);

    if (!checkError) {
      return NextResponse.json({
        success: true,
        message: 'time_entries table already exists and is accessible ✅',
        steps: ['Table exists, no action needed'],
      });
    }

    // Table doesn't exist — create it via insert/select trick won't work.
    // Use the Supabase Management API via fetch
    const mgmtUrl = `https://api.supabase.com/v1/projects/${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('.')[0].split('//')[1]}/database/query`;

    results.push('time_entries table does not exist, need to create via Supabase dashboard');
    results.push('Please run the SQL from /api/migration-sql in your Supabase SQL editor');

    return NextResponse.json({
      success: false,
      message: 'Table needs to be created manually. See /api/migration-sql for the SQL.',
      steps: results,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}

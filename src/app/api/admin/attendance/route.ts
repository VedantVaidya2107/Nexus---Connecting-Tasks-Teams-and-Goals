import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null as any;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('from') || new Date().toISOString().split('T')[0];
    const dateTo = searchParams.get('to') || new Date().toISOString().split('T')[0];
    const userId = searchParams.get('user_id') || null;

    let query = supabaseAdmin
      .from('attendance_records')
      .select(`
        *,
        user:profiles(id, full_name, email, avatar_url, role, department, job_title)
      `)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: false })
      .order('check_in_time', { ascending: true });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Compute summary stats
    const total = data?.length || 0;
    const checkedOut = data?.filter((r: any) => r.check_out_time).length || 0;
    const totalMinutes = data?.reduce((acc: number, r: any) => {
      if (r.check_in_time && r.check_out_time) {
        const diff = new Date(r.check_out_time).getTime() - new Date(r.check_in_time).getTime();
        return acc + Math.round(diff / 60000);
      }
      return acc;
    }, 0) || 0;
    const avgHours = checkedOut > 0 ? (totalMinutes / checkedOut / 60).toFixed(1) : '0';

    return NextResponse.json({
      success: true,
      records: data || [],
      summary: {
        total_records: total,
        checked_out: checkedOut,
        still_in: total - checkedOut,
        avg_hours: avgHours,
        total_minutes: totalMinutes,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClientIP, isIPAllowed } from '@/lib/ipUtils';

const supabaseAdmin = (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null as any;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 });
    }

    const clientIP = getClientIP(request as unknown as Request);

    // Load wifi settings
    const { data: wifiData } = await supabaseAdmin
      .from('wifi_settings')
      .select('allowed_ips, is_active, network_name')
      .eq('is_active', true)
      .single();

    const allowedIPs: string[] = wifiData?.allowed_ips || [];
    const networkName: string = wifiData?.network_name || 'Office Network';

    if (allowedIPs.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Network not configured. Please ask your admin to set up WiFi settings.',
        client_ip: clientIP,
      }, { status: 403 });
    }

    const networkVerified = isIPAllowed(clientIP, allowedIPs);

    if (!networkVerified) {
      return NextResponse.json({
        success: false,
        message: `You must be connected to ${networkName} to check out. Your current IP: ${clientIP}`,
        client_ip: clientIP,
        network_verified: false,
      }, { status: 403 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Find today's check-in record
    const { data: existing } = await supabaseAdmin
      .from('attendance_records')
      .select('*')
      .eq('user_id', user_id)
      .eq('date', today)
      .single();

    if (!existing?.check_in_time) {
      return NextResponse.json({
        success: false,
        message: 'You have not checked in today.',
      }, { status: 400 });
    }

    if (existing?.check_out_time) {
      return NextResponse.json({
        success: false,
        message: 'You have already checked out today.',
        record: existing,
      }, { status: 409 });
    }

    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('attendance_records')
      .update({
        check_out_time: now,
        check_out_ip: clientIP,
        updated_at: now,
      })
      .eq('user_id', user_id)
      .eq('date', today)
      .select()
      .single();

    if (error) throw error;

    // Calculate duration
    const checkIn = new Date(existing.check_in_time);
    const checkOut = new Date(now);
    const durationMs = checkOut.getTime() - checkIn.getTime();
    const durationHours = Math.floor(durationMs / 3600000);
    const durationMins = Math.floor((durationMs % 3600000) / 60000);

    return NextResponse.json({
      success: true,
      message: `✅ Checked out successfully. Duration: ${durationHours}h ${durationMins}m`,
      record: data,
      network_verified: true,
      client_ip: clientIP,
      duration_minutes: Math.round(durationMs / 60000),
    });
  } catch (err: any) {
    console.error('Check-out error:', err);
    return NextResponse.json({ success: false, message: err.message || 'Internal server error' }, { status: 500 });
  }
}

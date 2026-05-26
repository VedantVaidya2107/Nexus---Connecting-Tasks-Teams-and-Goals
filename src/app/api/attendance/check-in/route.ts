import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClientIP, isIPAllowed } from '@/lib/ipUtils';

const supabaseAdmin = (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null as any;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, notes } = body;

    if (!user_id) {
      return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 });
    }

    // Extract client IP
    const clientIP = getClientIP(request as unknown as Request);

    // Load wifi settings
    const { data: wifiData } = await supabaseAdmin
      .from('wifi_settings')
      .select('allowed_ips, is_active, network_name')
      .eq('is_active', true)
      .single();

    const allowedIPs: string[] = wifiData?.allowed_ips || [];
    const networkName: string = wifiData?.network_name || 'Office Network';

    // If allowed_ips is empty → admin hasn't configured yet → block
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
        message: `You must be connected to ${networkName} to check in. Your current IP: ${clientIP}`,
        client_ip: clientIP,
        network_verified: false,
      }, { status: 403 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Check if already checked in today
    const { data: existing } = await supabaseAdmin
      .from('attendance_records')
      .select('*')
      .eq('user_id', user_id)
      .eq('date', today)
      .single();

    if (existing?.check_in_time) {
      return NextResponse.json({
        success: false,
        message: 'You have already checked in today.',
        record: existing,
      }, { status: 409 });
    }

    const now = new Date().toISOString();

    // Upsert attendance record
    const { data, error } = await supabaseAdmin
      .from('attendance_records')
      .upsert({
        user_id,
        date: today,
        check_in_time: now,
        check_in_ip: clientIP,
        network_verified: true,
        notes: notes || null,
        updated_at: now,
      }, { onConflict: 'user_id,date' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `✅ Checked in successfully on ${networkName}`,
      record: data,
      network_verified: true,
      client_ip: clientIP,
    });
  } catch (err: any) {
    console.error('Check-in error:', err);
    return NextResponse.json({ success: false, message: err.message || 'Internal server error' }, { status: 500 });
  }
}

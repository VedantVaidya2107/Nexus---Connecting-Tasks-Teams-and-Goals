import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClientIP, isIPAllowed } from '@/lib/ipUtils';

const supabaseAdmin = (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null as any;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];
    const clientIP = getClientIP(request as unknown as Request);

    // Load today's attendance
    const { data: record } = await supabaseAdmin
      .from('attendance_records')
      .select('*')
      .eq('user_id', user_id)
      .eq('date', today)
      .single();

    // Check network status
    const { data: wifiData } = await supabaseAdmin
      .from('wifi_settings')
      .select('allowed_ips, is_active, network_name')
      .eq('is_active', true)
      .single();

    const allowedIPs: string[] = wifiData?.allowed_ips || [];
    const networkName: string = wifiData?.network_name || 'Office Network';
    const onNetwork = allowedIPs.length > 0 && isIPAllowed(clientIP, allowedIPs);

    // Fetch last 7 days of attendance
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const fromDate = sevenDaysAgo.toISOString().split('T')[0];

    const { data: history } = await supabaseAdmin
      .from('attendance_records')
      .select('*')
      .eq('user_id', user_id)
      .gte('date', fromDate)
      .order('date', { ascending: false });

    return NextResponse.json({
      success: true,
      today: record || null,
      history: history || [],
      network: {
        on_network: onNetwork,
        client_ip: clientIP,
        network_name: networkName,
        configured: allowedIPs.length > 0,
      },
    });
  } catch (err: any) {
    console.error('Today attendance error:', err);
    return NextResponse.json({ success: false, message: err.message || 'Internal server error' }, { status: 500 });
  }
}

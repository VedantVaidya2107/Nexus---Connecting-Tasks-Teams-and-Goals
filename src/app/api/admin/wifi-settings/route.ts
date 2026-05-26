import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClientIP } from '@/lib/ipUtils';

const supabaseAdmin = (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null as any;

// GET: Return current wifi settings + caller's IP (for admin to copy)
export async function GET(request: NextRequest) {
  try {
    const clientIP = getClientIP(request as unknown as Request);

    const { data, error } = await supabaseAdmin
      .from('wifi_settings')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return NextResponse.json({
      success: true,
      settings: data || { network_name: 'Office Network', allowed_ips: [], is_active: true },
      your_current_ip: clientIP,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// PUT: Update wifi settings (admin only — enforced via Supabase RLS for SELECT, but here we trust the admin UI)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { network_name, allowed_ips } = body;

    if (!network_name || !Array.isArray(allowed_ips)) {
      return NextResponse.json({ success: false, message: 'network_name and allowed_ips array required' }, { status: 400 });
    }

    // Clean and deduplicate IPs
    const cleanedIPs = [...new Set(
      (allowed_ips as string[])
        .map((ip: string) => ip.trim())
        .filter((ip: string) => ip.length > 0)
    )];

    // Check if a row exists
    const { data: existing } = await supabaseAdmin
      .from('wifi_settings')
      .select('id')
      .single();

    let result;
    if (existing?.id) {
      result = await supabaseAdmin
        .from('wifi_settings')
        .update({
          network_name: network_name.trim(),
          allowed_ips: cleanedIPs,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      result = await supabaseAdmin
        .from('wifi_settings')
        .insert({
          network_name: network_name.trim(),
          allowed_ips: cleanedIPs,
          is_active: true,
        })
        .select()
        .single();
    }

    if (result.error) throw result.error;

    return NextResponse.json({
      success: true,
      message: 'WiFi settings updated successfully',
      settings: result.data,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { processUserQuery } from '@/lib/ai/gemini';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { message, conversationId } = await req.json();
    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 });

    // 1. Get or create conversation
    let currentConvId = conversationId;
    if (!currentConvId) {
      const { data: conv } = await supabase
        .from('ai_conversations')
        .insert({ user_id: user.id })
        .select()
        .single();
      currentConvId = conv?.id;
    }

    // 2. Fetch history
    const { data: history } = await supabase
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', currentConvId)
      .order('created_at', { ascending: true })
      .limit(10);

    // 3. Save user message
    await supabase.from('ai_messages').insert({
      conversation_id: currentConvId,
      role: 'user',
      content: message
    });

    // 4. Process with Gemini
    const aiResponse = await processUserQuery(message, user.id, history || []);

    // 5. Save AI message
    await supabase.from('ai_messages').insert({
      conversation_id: currentConvId,
      role: 'assistant',
      content: aiResponse.message,
      intent: aiResponse.intent,
      action_taken: aiResponse.action,
      metadata: aiResponse.data
    });

    return NextResponse.json({
      success: true,
      data: {
        ...aiResponse,
        conversationId: currentConvId
      }
    });

  } catch (error: any) {
    console.error('AI Chat Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

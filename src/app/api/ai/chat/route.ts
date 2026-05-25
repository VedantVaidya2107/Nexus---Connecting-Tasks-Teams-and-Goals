import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processUserQuery } from '@/lib/ai/gemini';
import { createTimeEntry, updateTimeEntry, deleteTimeEntry } from '@/actions/timeEntries';

// Admin client for executing bot actions
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid auth header' }, { status: 401 });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` }
        }
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { message, conversationId } = await req.json();
    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 });

    // 1. Get or create conversation
    let currentConvId = conversationId;
    if (!currentConvId) {
      const { data: conv, error: convError } = await supabase
        .from('ai_conversations')
        .insert({ user_id: user.id })
        .select()
        .single();
      if (convError) throw new Error(`Conversation creation failed: ${convError.message}`);
      currentConvId = conv?.id;
    }

    // 2. Fetch recent history for context
    const { data: history, error: historyError } = await supabase
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', currentConvId)
      .order('created_at', { ascending: true })
      .limit(10);
    if (historyError) throw new Error(`History fetch failed: ${historyError.message}`);

    // 3. Save user message
    const { error: msgError } = await supabase.from('ai_messages').insert({
      conversation_id: currentConvId,
      role: 'user',
      content: message
    });
    if (msgError) throw new Error(`Message save failed: ${msgError.message}`);

    // 4. Process with Gemini
    const aiResponse = await processUserQuery(message, user.id, history || []);

    // 5. Execute Actions if any
    if (aiResponse.action === 'create_task' && aiResponse.data) {
      const { title, project_id, priority, due_date, assignee_id } = aiResponse.data;
      await supabaseAdmin.from('tasks').insert({
        title,
        project_id,
        priority: priority || 'medium',
        due_date,
        assignee_id: assignee_id || user.id,
        status: 'pending'
      });
    } else if (aiResponse.action === 'update_task_status' && aiResponse.data) {
      const { task_id, status } = aiResponse.data;
      await supabaseAdmin.from('tasks').update({ status }).eq('id', task_id);
    } else if (aiResponse.action === 'assign_task' && aiResponse.data) {
      const { task_id, assignee_id } = aiResponse.data;
      await supabaseAdmin.from('tasks').update({ assignee_id }).eq('id', task_id);
    } else if (aiResponse.action === 'create_time_entry' && aiResponse.data) {
      const { task_id, duration_minutes, description, logged_date, is_billable } = aiResponse.data;
      await createTimeEntry({
        task_id: task_id || null,
        duration_minutes: Number(duration_minutes) || 0,
        description: description || null,
        logged_date: logged_date || new Date().toISOString().split('T')[0],
        is_billable: is_billable !== undefined ? is_billable : true
      }, user.id);
    } else if (aiResponse.action === 'update_time_entry' && aiResponse.data) {
      const { id, duration_minutes, description, logged_date, is_billable } = aiResponse.data;
      if (id) {
        const { data: existing } = await supabaseAdmin
          .from('time_entries')
          .select('duration_minutes, task_id')
          .eq('id', id)
          .single();
        if (existing) {
          await updateTimeEntry(
            id,
            {
              duration_minutes: duration_minutes !== undefined ? Number(duration_minutes) : existing.duration_minutes,
              description: description !== undefined ? description : null,
              logged_date: logged_date || new Date().toISOString().split('T')[0],
              is_billable: is_billable !== undefined ? is_billable : true
            },
            user.id,
            existing.duration_minutes,
            existing.task_id
          );
        }
      }
    } else if (aiResponse.action === 'delete_time_entry' && aiResponse.data) {
      const { id } = aiResponse.data;
      if (id) {
        const { data: existing } = await supabaseAdmin
          .from('time_entries')
          .select('duration_minutes, task_id')
          .eq('id', id)
          .single();
        if (existing) {
          await deleteTimeEntry(
            id,
            user.id,
            existing.duration_minutes,
            existing.task_id
          );
        }
      }
    }

    // 6. Save AI response
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
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

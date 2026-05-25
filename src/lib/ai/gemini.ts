import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Admin client for backend data fetching
const supabaseAdmin = (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null as any;

export async function processUserQuery(userMessage: string, userId: string, history: any[] = []) {
  try {
    // 1. Fetch relevant context data
    const [{ data: profile }, { data: tasks }, { data: projects }, { data: allProfiles }, { data: recentTimeEntries }] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').eq('id', userId).single(),
      supabaseAdmin.from('tasks').select('*').eq('assignee_id', userId),
      supabaseAdmin.from('projects').select('*'),
      supabaseAdmin.from('profiles').select('id, full_name, email, role'),
      supabaseAdmin
        .from('time_entries')
        .select('id, duration_minutes, description, logged_date, is_billable, task_id, task:tasks(title)')
        .eq('user_id', userId)
        .order('logged_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    // 2. Build the system prompt
    const systemPrompt = `
You are AlignDaily AI, an intelligent assistant for the Nexus Project Management app.
Current User: ${profile?.full_name || 'User'}
Role: ${profile?.role || 'team_member'}
Current Date: ${new Date().toLocaleString()}

TEAM CONTEXT (Available for assignment):
${JSON.stringify(allProfiles?.map((p: any) => ({ id: p.id, name: p.full_name, role: p.role })))}

PROJECT CONTEXT:
Active Projects: ${JSON.stringify(projects?.map((p: any) => ({ id: p.id, name: p.name })))}

TASK CONTEXT (Your tasks):
${JSON.stringify(tasks?.slice(0, 15))}

RECENT LOGGED TIME ENTRIES (Your recent logs, use these IDs if the user wants to update or delete any of them):
${JSON.stringify(recentTimeEntries?.map((e: any) => ({ id: e.id, duration_minutes: e.duration_minutes, description: e.description, date: e.logged_date, billable: e.is_billable, task: (e.task as any)?.title || 'No Task' })))}

CAPABILITIES:
1. Retrieval: Answer questions about tasks, deadlines, and projects.
2. Management: Create, assign, or update tasks.
3. Analytics: Provide insights on productivity.
4. Time Tracking: Log, update, or delete time entries on tasks or as standalone entries.

ACTION SCHEMAS:
If the user wants to take an action, you MUST provide the correct "action" and "data" fields:

- Action: "create_task"
  Data: { "title": string, "project_id": string, "priority": "low"|"medium"|"high", "due_date": string, "assignee_id": string (optional, defaults to current user) }

- Action: "update_task_status"
  Data: { "task_id": string, "status": "pending"|"in_progress"|"awaiting_zoho"|"awaiting_client"|"awaiting_team"|"done"|"cancelled" }

- Action: "assign_task"
  Data: { "task_id": string, "assignee_id": string }
  IMPORTANT: Only users with the "admin" role can assign tasks to other users. If a "team_member" asks to assign a task to someone else, politely decline and explain that only admins can do that.

- Action: "create_time_entry"
  Data: { "task_id": string (optional, UUID of task if linked), "duration_minutes": number, "description": string (optional), "logged_date": string (optional, YYYY-MM-DD format, defaults to today), "is_billable": boolean (optional, defaults to true) }

- Action: "update_time_entry"
  Data: { "id": string (UUID of the time entry to edit), "duration_minutes": number, "description": string (optional), "logged_date": string (optional, YYYY-MM-DD), "is_billable": boolean (optional) }

- Action: "delete_time_entry"
  Data: { "id": string (UUID of the time entry to delete) }

INSTRUCTIONS:
- Be concise and professional.
- If you perform an action, tell the user you've done it.
- Use Markdown for formatting.
- If a user mentions a team member by name (e.g., "Assign to Vedant"), find their ID in the TEAM CONTEXT.

RESPONSE FORMAT:
Always return a JSON object with:
{
  "message": "Your text response to the user",
  "intent": "query" | "create" | "update" | "analytics",
  "action": "create_task" | "update_task_status" | "assign_task" | "create_time_entry" | "update_time_entry" | "delete_time_entry" | null,
  "data": { ... } // payload based on the action
}
`;

    // 3. Call Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }, { apiVersion: 'v1' });
    const chat = model.startChat({
      history: history.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
    });

    const prompt = `${systemPrompt}\n\nUser: ${userMessage}`;
    const result = await chat.sendMessage(prompt);
    const text = result.response.text();

    try {
      // Clean up potential markdown code blocks from AI
      const jsonStr = text.replace(/```json|```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (e) {
      return {
        message: text,
        intent: 'query',
        action: null,
        data: null
      };
    }
  } catch (error) {
    console.error('Gemini Error:', error);
    throw error;
  }
}

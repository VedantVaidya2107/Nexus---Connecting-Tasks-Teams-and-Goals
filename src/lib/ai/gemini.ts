import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Admin client for backend data fetching
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function processUserQuery(userMessage: string, userId: string, history: any[] = []) {
  try {
    // 1. Fetch relevant context data
    const [{ data: profile }, { data: tasks }, { data: projects }, { data: allProfiles }] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').eq('id', userId).single(),
      supabaseAdmin.from('tasks').select('*').eq('assignee_id', userId),
      supabaseAdmin.from('projects').select('*'),
      supabaseAdmin.from('profiles').select('id, full_name, email, role'),
    ]);

    // 2. Build the system prompt
    const systemPrompt = `
You are AlignDaily AI, an intelligent assistant for the Nexus Project Management app.
Current User: ${profile?.full_name || 'User'}
Role: ${profile?.role || 'team_member'}
Current Date: ${new Date().toLocaleString()}

TEAM CONTEXT (Available for assignment):
${JSON.stringify(allProfiles?.map(p => ({ id: p.id, name: p.full_name, role: p.role })))}

PROJECT CONTEXT:
Active Projects: ${JSON.stringify(projects?.map(p => ({ id: p.id, name: p.name })))}

TASK CONTEXT (Your tasks):
${JSON.stringify(tasks?.slice(0, 15))}

CAPABILITIES:
1. Retrieval: Answer questions about tasks, deadlines, and projects.
2. Management: Create, assign, or update tasks.
3. Analytics: Provide insights on productivity.

ACTION SCHEMAS:
If the user wants to take an action, you MUST provide the correct "action" and "data" fields:

- Action: "create_task"
  Data: { "title": string, "project_id": string, "priority": "low"|"medium"|"high", "due_date": string, "assignee_id": string (optional, defaults to current user) }

- Action: "update_task_status"
  Data: { "task_id": string, "status": "pending"|"in_progress"|"awaiting_zoho"|"awaiting_client"|"awaiting_team"|"done"|"cancelled" }

- Action: "assign_task"
  Data: { "task_id": string, "assignee_id": string }
  IMPORTANT: Only users with the "admin" role can assign tasks to other users. If a "team_member" asks to assign a task to someone else, politely decline and explain that only admins can do that.

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
  "action": "create_task" | "update_task_status" | "assign_task" | null,
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

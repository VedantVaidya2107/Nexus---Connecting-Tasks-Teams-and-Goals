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
    const [{ data: profile }, { data: tasks }, { data: projects }] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').eq('id', userId).single(),
      supabaseAdmin.from('tasks').select('*').eq('assignee_id', userId),
      supabaseAdmin.from('projects').select('*'),
    ]);

    // 2. Build the system prompt
    const systemPrompt = `
You are AlignDaily AI, an intelligent assistant for the Nexus Project Management app.
Current User: ${profile?.full_name || 'User'}
Role: ${profile?.role || 'team_member'}
Current Date: ${new Date().toLocaleString()}

CONTEXT:
Tasks assigned to you: ${JSON.stringify(tasks?.slice(0, 10))}
Total tasks: ${tasks?.length || 0}
Active Projects: ${JSON.stringify(projects?.map(p => ({ id: p.id, name: p.name })))}

CAPABILITIES:
1. Retrieval: Answer questions about tasks, deadlines, and projects.
2. Management: Help create or update tasks (suggest actions).
3. Analytics: Provide insights on productivity and blockers.

INSTRUCTIONS:
- Be concise and professional.
- If the user asks to create/update a task, suggest the fields.
- Use Markdown for formatting.
- If you can't find specific info, say so politely.

RESPONSE FORMAT:
Always return a JSON object with:
{
  "message": "Your text response",
  "intent": "query|create|update|analytics",
  "action": "optional_action_name",
  "data": {} // any relevant data objects
}
`;

    // 3. Call Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
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

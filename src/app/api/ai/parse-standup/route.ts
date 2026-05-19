import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

    const { transcript } = await req.json();
    if (!transcript) return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });

    const systemPrompt = `
You are a standup assistant for the Nexus Project Management app.
The user has spoken their daily update as a single continuous transcribed speech.
Your task is to analyze the text and extract the update into three specific categories:
1. Completed Yesterday (what they completed/finished yesterday)
2. Planned Today (what they are working on/planning to do today)
3. Blockers (any problems, issues, obstacles, or type 'None' if none are mentioned)

Translate thecontinuous speech into clean, professionally formatted text or bullet points. 
Make sure you write in a concise, task-focused, professional tone.

Format your output EXACTLY as a JSON object, with no markdown styling or wrapping around it:
{
  "yesterday": "Bullet points or text of what was completed yesterday",
  "today": "Bullet points or text of what is planned for today",
  "blockers": "Description of blockers or 'None'"
}

Do not include any other text, notes, explanation, or HTML tags outside the JSON block. Return ONLY the JSON object.
`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }, { apiVersion: 'v1' });
    const result = await model.generateContent(`${systemPrompt}\n\nUser continuous speech transcript:\n"${transcript}"`);
    const responseText = result.response.text();

    try {
      const jsonStr = responseText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      return NextResponse.json({
        success: true,
        data: {
          yesterday: parsed.yesterday || '',
          today: parsed.today || '',
          blockers: parsed.blockers || 'None'
        }
      });
    } catch (parseError) {
      console.error('Failed to parse Gemini output:', responseText, parseError);
      return NextResponse.json({
        success: false,
        error: 'AI did not return valid structured data. Please try speaking again.',
        rawText: responseText
      });
    }
  } catch (error: any) {
    console.error('AI Standup Parse Error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import type { Task, TaskStatus, TaskPriority } from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin client to bypass RLS for validation/logging
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function createTask(formData: any, creatorId: string) {
  try {
    const { title, description, status, priority, assignee_id, project_id, due_date } = formData;

    if (!title) return { success: false, message: 'Title is required' };

    const { data, error } = await supabaseAdmin.from('tasks').insert({
      title,
      description,
      status: status as TaskStatus,
      priority: priority as TaskPriority,
      assignee_id,
      project_id,
      due_date,
      reporter_id: creatorId
    }).select().single();

    if (error) return { success: false, message: error.message };

    // Log Activity
    await supabaseAdmin.from('activity_log').insert({
      user_id: creatorId,
      action: 'created task',
      entity_type: 'task',
      entity_id: data.id,
      entity_name: title
    });

    revalidatePath('/tasks');
    revalidatePath('/dashboard');
    
    return { success: true, data };
  } catch (err: any) {
    return { success: false, message: 'Server error' };
  }
}

export async function updateTaskStatus(taskId: string, status: TaskStatus, userId: string) {
  try {
    const { data: task } = await supabaseAdmin.from('tasks').select('title').eq('id', taskId).single();
    
    const { error } = await supabaseAdmin
      .from('tasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) return { success: false, message: error.message };

    // Log Activity
    await supabaseAdmin.from('activity_log').insert({
      user_id: userId,
      action: `moved task to ${status}`,
      entity_type: 'task',
      entity_id: taskId,
      entity_name: task?.title
    });

    revalidatePath('/tasks');
    return { success: true };
  } catch (err: any) {
    return { success: false, message: 'Server error' };
  }
}

export async function updateTask(taskId: string, formData: any, userId: string) {
  try {
    const { title, description, status, priority, assignee_id, project_id, due_date } = formData;

    const { error } = await supabaseAdmin.from('tasks').update({
      title,
      description,
      status: status as TaskStatus,
      priority: priority as TaskPriority,
      assignee_id,
      project_id,
      due_date,
      updated_at: new Date().toISOString()
    }).eq('id', taskId);

    if (error) return { success: false, message: error.message };

    // Log Activity
    await supabaseAdmin.from('activity_log').insert({
      user_id: userId,
      action: 'updated task',
      entity_type: 'task',
      entity_id: taskId,
      entity_name: title
    });

    revalidatePath('/tasks');
    revalidatePath('/dashboard');
    
    return { success: true };
  } catch (err: any) {
    return { success: false, message: 'Server error' };
  }
}

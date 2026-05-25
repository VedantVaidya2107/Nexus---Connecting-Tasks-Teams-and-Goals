'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

const supabaseAdmin = (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null as any;

export async function createTimeEntry(
  data: {
    task_id: string | null;
    duration_minutes: number;
    description: string | null;
    logged_date: string;
    is_billable?: boolean;
  },
  userId: string
) {
  try {
    if (!data.duration_minutes || data.duration_minutes <= 0) {
      return { success: false, message: 'Duration must be greater than 0' };
    }

    // Ensure description is mandatory
    if (!data.description || !data.description.trim()) {
      return { success: false, message: 'Description is required' };
    }

    // Prevent duplicate entries for the same task (or standalone entries with the same description) on the same date by the same user
    if (data.task_id) {
      const { data: existing } = await supabaseAdmin
        .from('time_entries')
        .select('id')
        .eq('user_id', userId)
        .eq('task_id', data.task_id)
        .eq('logged_date', data.logged_date)
        .maybeSingle();

      if (existing) {
        return {
          success: false,
          message: 'A time entry already exists for this task on this date. You can edit the existing entry instead.',
        };
      }
    } else {
      const { data: existing } = await supabaseAdmin
        .from('time_entries')
        .select('id')
        .eq('user_id', userId)
        .is('task_id', null)
        .eq('logged_date', data.logged_date)
        .maybeSingle();

      if (existing) {
        return {
          success: false,
          message: 'A standalone time entry already exists on this date. You can edit the existing entry instead.',
        };
      }
    }

    const { data: entry, error } = await supabaseAdmin
      .from('time_entries')
      .insert({
        task_id: data.task_id || null,
        user_id: userId,
        duration_minutes: data.duration_minutes,
        description: data.description || null,
        logged_date: data.logged_date,
        is_billable: data.is_billable !== undefined ? data.is_billable : true,
      })
      .select()
      .single();

    if (error) return { success: false, message: error.message };

    // Update time_spent_minutes on the task if linked
    if (data.task_id) {
      const { data: task } = await supabaseAdmin
        .from('tasks')
        .select('time_spent_minutes, title')
        .eq('id', data.task_id)
        .single();

      if (task) {
        await supabaseAdmin
          .from('tasks')
          .update({
            time_spent_minutes: (task.time_spent_minutes || 0) + data.duration_minutes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.task_id);

        // Log activity
        await supabaseAdmin.from('activity_log').insert({
          user_id: userId,
          action: `logged ${Math.round((data.duration_minutes / 60) * 10) / 10}h on task`,
          entity_type: 'task',
          entity_id: data.task_id,
          entity_name: task.title,
        });
      }
    }

    revalidatePath('/time-tracker');
    revalidatePath('/tasks');
    revalidatePath('/dashboard');
    revalidatePath('/reports');

    return { success: true, data: entry };
  } catch (err: any) {
    return { success: false, message: 'Server error: ' + err.message };
  }
}

export async function updateTimeEntry(
  id: string,
  data: {
    duration_minutes: number;
    description: string | null;
    logged_date: string;
    is_billable?: boolean;
  },
  userId: string,
  oldDuration: number,
  taskId: string | null
) {
  try {
    // Ensure description is mandatory
    if (!data.description || !data.description.trim()) {
      return { success: false, message: 'Description is required' };
    }

    // Prevent duplicate entries for the same task (or standalone entries with the same description) on the same date by the same user (excluding this entry itself)
    if (taskId) {
      const { data: existing } = await supabaseAdmin
        .from('time_entries')
        .select('id')
        .eq('user_id', userId)
        .eq('task_id', taskId)
        .eq('logged_date', data.logged_date)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        return {
          success: false,
          message: 'A time entry already exists for this task on this date. You can edit the existing entry instead.',
        };
      }
    } else {
      const { data: existing } = await supabaseAdmin
        .from('time_entries')
        .select('id')
        .eq('user_id', userId)
        .is('task_id', null)
        .eq('logged_date', data.logged_date)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        return {
          success: false,
          message: 'A standalone time entry already exists on this date. You can edit the existing entry instead.',
        };
      }
    }

    const updatePayload: any = {
      duration_minutes: data.duration_minutes,
      description: data.description || null,
      logged_date: data.logged_date,
      updated_at: new Date().toISOString(),
    };
    if (data.is_billable !== undefined) updatePayload.is_billable = data.is_billable;

    const { error } = await supabaseAdmin
      .from('time_entries')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) return { success: false, message: error.message };

    // Adjust time_spent_minutes on task
    if (taskId) {
      const { data: task } = await supabaseAdmin
        .from('tasks')
        .select('time_spent_minutes')
        .eq('id', taskId)
        .single();

      if (task) {
        const diff = data.duration_minutes - oldDuration;
        await supabaseAdmin
          .from('tasks')
          .update({
            time_spent_minutes: Math.max(0, (task.time_spent_minutes || 0) + diff),
            updated_at: new Date().toISOString(),
          })
          .eq('id', taskId);
      }
    }

    revalidatePath('/time-tracker');
    revalidatePath('/tasks');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (err: any) {
    return { success: false, message: 'Server error: ' + err.message };
  }
}

export async function deleteTimeEntry(
  id: string,
  userId: string,
  durationMinutes: number,
  taskId: string | null
) {
  try {
    const { error } = await supabaseAdmin
      .from('time_entries')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) return { success: false, message: error.message };

    // Subtract time from task
    if (taskId) {
      const { data: task } = await supabaseAdmin
        .from('tasks')
        .select('time_spent_minutes')
        .eq('id', taskId)
        .single();

      if (task) {
        await supabaseAdmin
          .from('tasks')
          .update({
            time_spent_minutes: Math.max(0, (task.time_spent_minutes || 0) - durationMinutes),
            updated_at: new Date().toISOString(),
          })
          .eq('id', taskId);
      }
    }

    revalidatePath('/time-tracker');
    revalidatePath('/tasks');
    revalidatePath('/dashboard');

    return { success: true };
  } catch (err: any) {
    return { success: false, message: 'Server error: ' + err.message };
  }
}

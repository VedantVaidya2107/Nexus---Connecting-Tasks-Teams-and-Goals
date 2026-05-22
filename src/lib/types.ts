// ============================================
// Type Definitions
// ============================================

export type UserRole = 'admin' | 'manager' | 'team_member';
export type ProjectStatus = 'active' | 'completed' | 'paused' | 'archived';
export type TaskStatus = 'pending' | 'in_progress' | 'awaiting_zoho' | 'awaiting_client' | 'awaiting_team' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url: string | null;
  department: string | null;
  job_title: string | null;
  phone: string | null;
  is_active: boolean;
  must_change_password: boolean;
  start_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: ProjectStatus;
  color: string;
  owner_id: string | null;
  team_ids: string[] | null;
  created_at: string;
  updated_at: string;
  // Computed
  owner?: Profile;
  task_count?: number;
  completed_task_count?: number;
}

export interface Task {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: string | null;
  reporter_id: string | null;
  due_date: string | null;
  start_date: string | null;
  time_estimate_minutes: number | null;
  time_spent_minutes: number;
  progress_percentage: number;
  parent_task_id: string | null;
  sort_order: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  // Joined
  assignee?: Profile;
  reporter?: Profile;
  project?: Project;
  comments?: Comment[];
  subtasks?: Task[];
}

export interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  duration_minutes: number;
  description: string | null;
  logged_date: string;
  is_billable: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  user?: Profile;
  task?: Task;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: Profile;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  user?: Profile;
}

export interface DailyUpdate {
  id: string;
  user_id: string;
  date: string;
  completed_yesterday: string | null;
  planned_today: string | null;
  blockers: string | null;
  created_at: string;
  user?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

// ============================================
// Status/Priority Display Helpers
// ============================================

export const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  awaiting_zoho: { label: 'Awaiting from Zoho', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  awaiting_client: { label: 'Awaiting from Client', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
  awaiting_team: { label: 'Awaiting from Team', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
  done: { label: 'Done', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
  cancelled: { label: 'Cancelled', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
};

export const TASK_PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; icon: string }> = {
  high: { label: 'High', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: '🔴' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: '🟡' },
  low: { label: 'Low', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', icon: '🟢' },
};

export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: '#22c55e' },
  completed: { label: 'Completed', color: '#3b82f6' },
  paused: { label: 'Paused', color: '#f59e0b' },
  archived: { label: 'Archived', color: '#94a3b8' },
};

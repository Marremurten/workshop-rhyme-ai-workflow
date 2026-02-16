export type ColumnId = 'todo' | 'in_progress' | 'review' | 'done';

export interface Task {
  id: number;
  title: string;
  description: string | null;
  column: ColumnId;
  position: number;
  assignee_id: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error';
}

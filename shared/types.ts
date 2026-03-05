export type ColumnId = "todo" | "in_progress" | "review" | "done";

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

export interface CreateTaskInput {
  title: string;
  description?: string;
  column?: ColumnId;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  assignee_id?: number | null;
  column?: ColumnId;
}

export interface TasksResponse {
  tasks: Task[];
}

export interface TaskResponse {
  task: Task;
}

export interface UsersResponse {
  users: User[];
}

export interface AuthResponse {
  user: User;
}

export interface MessageResponse {
  message: string;
}

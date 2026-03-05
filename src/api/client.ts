import type {
  AuthResponse,
  MessageResponse,
  TasksResponse,
  TaskResponse,
  UsersResponse,
  CreateTaskInput,
  UpdateTaskInput,
} from "../../shared/types";

async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...options });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error: string }).error);
  }
  return data;
}

function postOptions(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function login(email: string, password: string) {
  return request<AuthResponse>("/api/auth/login", postOptions({ email, password }));
}

export async function register(email: string, name: string, password: string) {
  return request<AuthResponse>("/api/auth/register", postOptions({ email, name, password }));
}

export async function fetchMe() {
  return request<AuthResponse>("/api/auth/me");
}

export async function logout() {
  return request<MessageResponse>("/api/auth/logout", { method: "POST" });
}

export async function fetchUsers() {
  return request<UsersResponse>("/api/users");
}

export async function fetchTasks() {
  return request<TasksResponse>("/api/tasks");
}

export async function createTask(data: CreateTaskInput) {
  return request<TaskResponse>("/api/tasks", postOptions(data));
}

export async function updateTask(id: number, data: UpdateTaskInput) {
  return request<TaskResponse>(`/api/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteTask(id: number) {
  return request<MessageResponse>(`/api/tasks/${id}`, { method: "DELETE" });
}

export async function moveTask(id: number, column: string, index: number) {
  return request<TaskResponse>(`/api/tasks/${id}/move`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ column, index }),
  });
}

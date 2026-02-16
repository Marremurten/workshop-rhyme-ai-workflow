async function request(url: string, options: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, { credentials: 'include', ...options });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data as { error: string }).error);
  }
  return data;
}

function postOptions(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function login(email: string, password: string) {
  return request('/api/auth/login', postOptions({ email, password }));
}

export async function register(email: string, name: string, password: string) {
  return request('/api/auth/register', postOptions({ email, name, password }));
}

export async function fetchMe() {
  return request('/api/auth/me');
}

export async function logout() {
  return request('/api/auth/logout', { method: 'POST' });
}

export async function fetchUsers() {
  return request('/api/users');
}

export async function fetchTasks() {
  return request('/api/tasks');
}

export async function createTask(data: Record<string, unknown>) {
  return request('/api/tasks', postOptions(data));
}

export async function updateTask(id: number, data: Record<string, unknown>) {
  return request(`/api/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteTask(id: number) {
  return request(`/api/tasks/${id}`, { method: 'DELETE' });
}

export async function moveTask(id: number, column: string, index: number) {
  return request(`/api/tasks/${id}/move`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ column, index }),
  });
}

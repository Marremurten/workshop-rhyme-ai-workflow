import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  login,
  register,
  fetchMe,
  logout,
  fetchUsers,
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
  moveTask,
} from '../api/client';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response;
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// login
// ---------------------------------------------------------------------------
describe('login', () => {
  it('sends POST to /api/auth/login with credentials and returns user', async () => {
    const user = { id: 1, email: 'a@b.com', name: 'Alice' };
    mockFetch.mockResolvedValueOnce(jsonResponse({ user }));

    const result = await login('a@b.com', 'password123');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('include');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ email: 'a@b.com', password: 'password123' });
    expect(result).toEqual({ user });
  });

  it('throws an error with the server message on failure', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse('Invalid email or password', 401));

    await expect(login('a@b.com', 'wrong')).rejects.toThrow('Invalid email or password');
  });
});

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------
describe('register', () => {
  it('sends POST to /api/auth/register with credentials and returns user', async () => {
    const user = { id: 2, email: 'b@c.com', name: 'Bob' };
    mockFetch.mockResolvedValueOnce(jsonResponse({ user }, 201));

    const result = await register('b@c.com', 'Bob', 'secret');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/auth/register');
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('include');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({
      email: 'b@c.com',
      name: 'Bob',
      password: 'secret',
    });
    expect(result).toEqual({ user });
  });

  it('throws an error with the server message on failure', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse('Email already registered', 409));

    await expect(register('b@c.com', 'Bob', 'secret')).rejects.toThrow('Email already registered');
  });

  it('throws when required fields are missing', async () => {
    mockFetch.mockResolvedValueOnce(
      errorResponse('Email, name, and password are required', 400),
    );

    await expect(register('', '', '')).rejects.toThrow(
      'Email, name, and password are required',
    );
  });
});

// ---------------------------------------------------------------------------
// fetchMe
// ---------------------------------------------------------------------------
describe('fetchMe', () => {
  it('sends GET to /api/auth/me with credentials and returns user', async () => {
    const user = { id: 1, email: 'a@b.com', name: 'Alice' };
    mockFetch.mockResolvedValueOnce(jsonResponse({ user }));

    const result = await fetchMe();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/auth/me');
    // GET is the default for fetch; implementation may omit method or set it explicitly
    if (options.method) {
      expect(options.method).toBe('GET');
    }
    expect(options.credentials).toBe('include');
    expect(result).toEqual({ user });
  });

  it('throws when not authenticated', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse('Unauthorized', 401));

    await expect(fetchMe()).rejects.toThrow('Unauthorized');
  });
});

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------
describe('logout', () => {
  it('sends POST to /api/auth/logout with credentials', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Logged out' }));

    const result = await logout();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/auth/logout');
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('include');
    expect(result).toEqual({ message: 'Logged out' });
  });
});

// ---------------------------------------------------------------------------
// fetchUsers
// ---------------------------------------------------------------------------
describe('fetchUsers', () => {
  it('sends GET to /api/users with credentials and returns users', async () => {
    const users = [
      { id: 1, email: 'a@b.com', name: 'Alice' },
      { id: 2, email: 'b@c.com', name: 'Bob' },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse({ users }));

    const result = await fetchUsers();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/users');
    expect(options.credentials).toBe('include');
    expect(result).toEqual({ users });
  });

  it('throws on error response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse('Unauthorized', 401));

    await expect(fetchUsers()).rejects.toThrow('Unauthorized');
  });
});

// ---------------------------------------------------------------------------
// fetchTasks
// ---------------------------------------------------------------------------
describe('fetchTasks', () => {
  it('sends GET to /api/tasks with credentials and returns tasks', async () => {
    const tasks = [
      {
        id: 1,
        title: 'Task 1',
        description: null,
        column: 'todo',
        position: 1000,
        assignee_id: null,
        created_by: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse({ tasks }));

    const result = await fetchTasks();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/tasks');
    expect(options.credentials).toBe('include');
    expect(result).toEqual({ tasks });
  });

  it('throws on error response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse('Unauthorized', 401));

    await expect(fetchTasks()).rejects.toThrow('Unauthorized');
  });
});

// ---------------------------------------------------------------------------
// createTask
// ---------------------------------------------------------------------------
describe('createTask', () => {
  it('sends POST to /api/tasks with task data and credentials', async () => {
    const task = {
      id: 1,
      title: 'New task',
      description: null,
      column: 'todo',
      position: 1000,
      assignee_id: null,
      created_by: 1,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };
    mockFetch.mockResolvedValueOnce(jsonResponse({ task }, 201));

    const result = await createTask({ title: 'New task' });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/tasks');
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('include');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ title: 'New task' });
    expect(result).toEqual({ task });
  });

  it('sends optional fields when provided', async () => {
    const taskData = { title: 'Task', description: 'Desc', column: 'in_progress', assignee_id: 2 };
    const task = { id: 2, ...taskData, position: 1000, created_by: 1, created_at: '', updated_at: '' };
    mockFetch.mockResolvedValueOnce(jsonResponse({ task }, 201));

    await createTask(taskData);

    const [, options] = mockFetch.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual(taskData);
  });

  it('throws on error response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse('Title is required', 400));

    await expect(createTask({ title: '' })).rejects.toThrow('Title is required');
  });
});

// ---------------------------------------------------------------------------
// updateTask
// ---------------------------------------------------------------------------
describe('updateTask', () => {
  it('sends PUT to /api/tasks/:id with update data and credentials', async () => {
    const task = {
      id: 5,
      title: 'Updated',
      description: 'New desc',
      column: 'todo',
      position: 1000,
      assignee_id: null,
      created_by: 1,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    };
    mockFetch.mockResolvedValueOnce(jsonResponse({ task }));

    const result = await updateTask(5, { title: 'Updated', description: 'New desc' });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/tasks/5');
    expect(options.method).toBe('PUT');
    expect(options.credentials).toBe('include');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ title: 'Updated', description: 'New desc' });
    expect(result).toEqual({ task });
  });

  it('can set assignee_id to null', async () => {
    const task = { id: 5, title: 'T', assignee_id: null };
    mockFetch.mockResolvedValueOnce(jsonResponse({ task }));

    await updateTask(5, { assignee_id: null });

    const [, options] = mockFetch.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ assignee_id: null });
  });

  it('throws on 404 response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse('Task not found', 404));

    await expect(updateTask(999, { title: 'Nope' })).rejects.toThrow('Task not found');
  });
});

// ---------------------------------------------------------------------------
// deleteTask
// ---------------------------------------------------------------------------
describe('deleteTask', () => {
  it('sends DELETE to /api/tasks/:id with credentials', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Task deleted' }));

    const result = await deleteTask(3);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/tasks/3');
    expect(options.method).toBe('DELETE');
    expect(options.credentials).toBe('include');
    expect(result).toEqual({ message: 'Task deleted' });
  });

  it('throws on 404 response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse('Task not found', 404));

    await expect(deleteTask(999)).rejects.toThrow('Task not found');
  });
});

// ---------------------------------------------------------------------------
// moveTask
// ---------------------------------------------------------------------------
describe('moveTask', () => {
  it('sends PATCH to /api/tasks/:id/move with column and index', async () => {
    const task = {
      id: 7,
      title: 'Moved',
      description: null,
      column: 'in_progress',
      position: 500,
      assignee_id: null,
      created_by: 1,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    };
    mockFetch.mockResolvedValueOnce(jsonResponse({ task }));

    const result = await moveTask(7, 'in_progress', 0);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/tasks/7/move');
    expect(options.method).toBe('PATCH');
    expect(options.credentials).toBe('include');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ column: 'in_progress', index: 0 });
    expect(result).toEqual({ task });
  });

  it('throws on 404 response', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse('Task not found', 404));

    await expect(moveTask(999, 'done', 0)).rejects.toThrow('Task not found');
  });

  it('throws on invalid column', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse('Invalid column', 400));

    await expect(moveTask(1, 'invalid', 0)).rejects.toThrow('Invalid column');
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: all functions include credentials
// ---------------------------------------------------------------------------
describe('credentials and headers', () => {
  it('all GET requests include credentials:include', async () => {
    const getters = [
      () => fetchMe(),
      () => fetchUsers(),
      () => fetchTasks(),
    ];

    for (const getter of getters) {
      mockFetch.mockResolvedValueOnce(jsonResponse({}));
      await getter();
      const [, options] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(options.credentials).toBe('include');
    }
  });

  it('all POST/PUT/PATCH/DELETE requests include credentials:include', async () => {
    const mutators: Array<[() => Promise<unknown>, string]> = [
      [() => login('a@b.com', 'pw'), 'login'],
      [() => register('a@b.com', 'A', 'pw'), 'register'],
      [() => logout(), 'logout'],
      [() => createTask({ title: 'T' }), 'createTask'],
      [() => updateTask(1, { title: 'T' }), 'updateTask'],
      [() => deleteTask(1), 'deleteTask'],
      [() => moveTask(1, 'todo', 0), 'moveTask'],
    ];

    for (const [mutator] of mutators) {
      mockFetch.mockResolvedValueOnce(jsonResponse({}, 200));
      await mutator();
      const [, options] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(options.credentials).toBe('include');
    }
  });

  it('POST/PUT/PATCH requests include Content-Type application/json', async () => {
    const withBody: Array<[() => Promise<unknown>, string]> = [
      [() => login('a@b.com', 'pw'), 'login'],
      [() => register('a@b.com', 'A', 'pw'), 'register'],
      [() => createTask({ title: 'T' }), 'createTask'],
      [() => updateTask(1, { title: 'T' }), 'updateTask'],
      [() => moveTask(1, 'todo', 0), 'moveTask'],
    ];

    for (const [fn, name] of withBody) {
      mockFetch.mockResolvedValueOnce(jsonResponse({}, 200));
      await fn();
      const [, options] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(options.headers['Content-Type'], `${name} should set Content-Type`).toBe(
        'application/json',
      );
    }
  });
});

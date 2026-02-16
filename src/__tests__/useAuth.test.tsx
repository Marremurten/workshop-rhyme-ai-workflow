// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import * as api from '../api/client';

vi.mock('../api/client', () => ({
  fetchMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
}));

const mockApi = api as {
  fetchMe: ReturnType<typeof vi.fn>;
  login: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  register: ReturnType<typeof vi.fn>;
};

function TestConsumer() {
  const { user, loading, login, logout, register } = useAuth();

  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? JSON.stringify(user) : 'null'}</span>
      <button
        data-testid="login-btn"
        onClick={() => login('a@b.com', 'password')}
      >
        Login
      </button>
      <button data-testid="logout-btn" onClick={() => logout()}>
        Logout
      </button>
      <button
        data-testid="register-btn"
        onClick={() => register('a@b.com', 'Alice', 'password')}
      >
        Register
      </button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuthProvider', () => {
  it('calls fetchMe on mount and sets user if authenticated', async () => {
    const user = { id: 1, email: 'a@b.com', name: 'Alice' };
    mockApi.fetchMe.mockResolvedValueOnce({ user });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe(JSON.stringify(user));
    });

    expect(mockApi.fetchMe).toHaveBeenCalledOnce();
  });

  it('shows loading state while checking auth', async () => {
    let resolveFetchMe!: (value: unknown) => void;
    mockApi.fetchMe.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetchMe = resolve;
      }),
    );

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('loading').textContent).toBe('true');

    await act(async () => {
      resolveFetchMe({ user: { id: 1, email: 'a@b.com', name: 'Alice' } });
    });

    expect(screen.getByTestId('loading').textContent).toBe('false');
  });

  it('sets user to null if fetchMe fails (not authenticated)', async () => {
    mockApi.fetchMe.mockRejectedValueOnce(new Error('Unauthorized'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('login function calls api.login and updates user state', async () => {
    const user = { id: 1, email: 'a@b.com', name: 'Alice' };
    mockApi.fetchMe.mockRejectedValueOnce(new Error('Unauthorized'));
    mockApi.login.mockResolvedValueOnce({ user });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByTestId('login-btn').click();
    });

    expect(mockApi.login).toHaveBeenCalledWith('a@b.com', 'password');
    expect(screen.getByTestId('user').textContent).toBe(JSON.stringify(user));
  });

  it('logout function calls api.logout and clears user state', async () => {
    const user = { id: 1, email: 'a@b.com', name: 'Alice' };
    mockApi.fetchMe.mockResolvedValueOnce({ user });
    mockApi.logout.mockResolvedValueOnce({ message: 'Logged out' });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe(JSON.stringify(user));
    });

    await act(async () => {
      screen.getByTestId('logout-btn').click();
    });

    expect(mockApi.logout).toHaveBeenCalledOnce();
    expect(screen.getByTestId('user').textContent).toBe('null');
  });

  it('register function calls api.register and updates user state', async () => {
    const user = { id: 2, email: 'a@b.com', name: 'Alice' };
    mockApi.fetchMe.mockRejectedValueOnce(new Error('Unauthorized'));
    mockApi.register.mockResolvedValueOnce({ user });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    await act(async () => {
      screen.getByTestId('register-btn').click();
    });

    expect(mockApi.register).toHaveBeenCalledWith('a@b.com', 'Alice', 'password');
    expect(screen.getByTestId('user').textContent).toBe(JSON.stringify(user));
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BoardHeader from '../components/BoardHeader';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
});

describe('BoardHeader', () => {
  it('renders the app title', () => {
    render(
      <BoardHeader userName="Alice" onRefresh={vi.fn()} onLogout={vi.fn()} />,
    );

    expect(screen.getByText(/kanban board/i)).toBeInTheDocument();
  });

  it('shows the current user name', () => {
    render(
      <BoardHeader userName="Alice" onRefresh={vi.fn()} onLogout={vi.fn()} />,
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('refresh button calls onRefresh when clicked', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();

    render(
      <BoardHeader userName="Bob" onRefresh={onRefresh} onLogout={vi.fn()} />,
    );

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('logout button calls onLogout when clicked', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();

    render(
      <BoardHeader userName="Charlie" onRefresh={vi.fn()} onLogout={onLogout} />,
    );

    const logoutButton = screen.getByRole('button', { name: /log\s*out|sign\s*out/i });
    await user.click(logoutButton);

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});

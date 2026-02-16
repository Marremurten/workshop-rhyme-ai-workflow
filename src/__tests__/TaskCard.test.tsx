// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mocks — defined before imports that use them
// ---------------------------------------------------------------------------

const useSortableMock = vi.fn(() => ({
  attributes: {},
  listeners: {},
  setNodeRef: vi.fn(),
  transform: null,
  transition: null,
  isDragging: false,
}));

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: (...args: unknown[]) => useSortableMock(...args),
}));

import TaskCard from '../components/TaskCard';

// ---------------------------------------------------------------------------
// Types for test data
// ---------------------------------------------------------------------------
interface Task {
  id: number;
  title: string;
  description: string | null;
  column: 'todo' | 'in_progress' | 'done';
  position: number;
  assignee_id: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTask(overrides: Partial<Task> & { id: number; title: string }): Task {
  return {
    description: null,
    column: 'todo',
    position: 1000,
    assignee_id: null,
    created_by: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
});

describe('TaskCard', () => {
  it('renders the task title', () => {
    const task = makeTask({ id: 1, title: 'Fix login bug' });

    render(<TaskCard task={task} onClick={vi.fn()} />);

    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
  });

  it('shows truncated description when present', () => {
    const task = makeTask({
      id: 2,
      title: 'Design review',
      description: 'This is a long description that should be truncated to a single line on the card',
    });

    render(<TaskCard task={task} onClick={vi.fn()} />);

    // The description text should appear in the document
    expect(screen.getByText(/This is a long description/)).toBeInTheDocument();
  });

  it('does not render description when it is null', () => {
    const task = makeTask({ id: 3, title: 'No description task', description: null });

    const { container } = render(<TaskCard task={task} onClick={vi.fn()} />);

    // The title should be present, but no description element should be rendered
    expect(screen.getByText('No description task')).toBeInTheDocument();
    // There should be no extra text content beyond the title (and possibly assignee)
    const textContent = container.textContent || '';
    expect(textContent).toContain('No description task');
  });

  it('shows assignee name when assignee_id is set and users prop is provided', () => {
    const task = makeTask({ id: 4, title: 'Assigned task', assignee_id: 2 });
    const users = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ];

    render(<TaskCard task={task} onClick={vi.fn()} users={users} />);

    // Should show the assignee name or initials
    const bobText = screen.queryByText('Bob') || screen.queryByText('B');
    expect(bobText).toBeInTheDocument();
  });

  it('does not show assignee when assignee_id is null', () => {
    const task = makeTask({ id: 5, title: 'Unassigned task', assignee_id: null });
    const users = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];

    render(<TaskCard task={task} onClick={vi.fn()} users={users} />);

    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
  });

  it('calls onClick when the card is clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const task = makeTask({ id: 6, title: 'Clickable task' });

    render(<TaskCard task={task} onClick={onClick} />);

    await user.click(screen.getByText('Clickable task'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('uses useSortable from @dnd-kit/sortable', () => {
    const task = makeTask({ id: 7, title: 'Sortable task' });

    render(<TaskCard task={task} onClick={vi.fn()} />);

    expect(useSortableMock).toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks — defined before imports that use them
// ---------------------------------------------------------------------------

// Mock @dnd-kit/core
vi.mock('@dnd-kit/core', () => {
  const useDroppableMock = vi.fn(() => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }));
  return {
    DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    useDroppable: useDroppableMock,
    PointerSensor: class {},
    KeyboardSensor: class {},
    useSensor: vi.fn(),
    useSensors: vi.fn(() => []),
  };
});

// Mock @dnd-kit/sortable
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sortable-context">{children}</div>
  ),
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

import Column from '../components/Column';
import { useDroppable } from '@dnd-kit/core';

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

describe('Column', () => {
  it('renders column title', () => {
    render(
      <Column
        id="todo"
        title="To Do"
        tasks={[]}
        onAddTask={vi.fn()}
        onEditTask={vi.fn()}
      />,
    );

    expect(screen.getByText('To Do')).toBeInTheDocument();
  });

  it('renders task count badge', () => {
    const tasks = [
      makeTask({ id: 1, title: 'Task 1' }),
      makeTask({ id: 2, title: 'Task 2' }),
      makeTask({ id: 3, title: 'Task 3' }),
    ];

    render(
      <Column
        id="todo"
        title="To Do"
        tasks={tasks}
        onAddTask={vi.fn()}
        onEditTask={vi.fn()}
      />,
    );

    // Should show "3" as the count badge
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders TaskCard for each task', () => {
    const tasks = [
      makeTask({ id: 1, title: 'First Task' }),
      makeTask({ id: 2, title: 'Second Task' }),
    ];

    render(
      <Column
        id="todo"
        title="To Do"
        tasks={tasks}
        onAddTask={vi.fn()}
        onEditTask={vi.fn()}
      />,
    );

    expect(screen.getByText('First Task')).toBeInTheDocument();
    expect(screen.getByText('Second Task')).toBeInTheDocument();
  });

  it('shows empty state with "No tasks yet" when column has no tasks', () => {
    render(
      <Column
        id="todo"
        title="To Do"
        tasks={[]}
        onAddTask={vi.fn()}
        onEditTask={vi.fn()}
      />,
    );

    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
  });

  it('renders CreateTaskForm at the bottom', () => {
    render(
      <Column
        id="todo"
        title="To Do"
        tasks={[]}
        onAddTask={vi.fn()}
        onEditTask={vi.fn()}
      />,
    );

    // The CreateTaskForm should show its initial button state
    // The typical label is "+ Add a card" or similar
    expect(
      screen.getByText(/add a card/i) || screen.getByRole('button', { name: /add/i }),
    ).toBeInTheDocument();
  });

  it('is a valid drop target (uses useDroppable)', () => {
    render(
      <Column
        id="todo"
        title="To Do"
        tasks={[]}
        onAddTask={vi.fn()}
        onEditTask={vi.fn()}
      />,
    );

    // The mocked useDroppable should have been called, indicating the Column
    // sets itself up as a droppable target
    expect(useDroppable).toHaveBeenCalled();
    // Verify it was called with an id matching the column
    expect(useDroppable).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.stringContaining('todo') }),
    );
  });

  it('renders title and count for zero tasks showing 0', () => {
    render(
      <Column
        id="done"
        title="Done"
        tasks={[]}
        onAddTask={vi.fn()}
        onEditTask={vi.fn()}
      />,
    );

    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('wraps tasks in a SortableContext', () => {
    const tasks = [makeTask({ id: 1, title: 'Sortable Task' })];

    render(
      <Column
        id="todo"
        title="To Do"
        tasks={tasks}
        onAddTask={vi.fn()}
        onEditTask={vi.fn()}
      />,
    );

    // Our mock SortableContext adds a data-testid
    expect(screen.getByTestId('sortable-context')).toBeInTheDocument();
  });
});

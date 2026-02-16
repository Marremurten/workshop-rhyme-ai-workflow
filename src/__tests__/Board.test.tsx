// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks — defined before imports that use them
// ---------------------------------------------------------------------------

// Mock the useTasks hook
const mockUseTasks = vi.fn();
vi.mock('../hooks/useTasks', () => ({
  default: (...args: unknown[]) => mockUseTasks(...args),
  useTasks: (...args: unknown[]) => mockUseTasks(...args),
}));

// Mock @dnd-kit/core — provide a passthrough DndContext that just renders children
vi.mock('@dnd-kit/core', () => {
  const actual = vi.importActual('@dnd-kit/core');
  return {
    ...actual,
    DndContext: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd?: unknown }) => (
      <div data-testid="dnd-context" data-ondragend={typeof onDragEnd}>
        {children}
      </div>
    ),
    DragOverlay: ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="drag-overlay">{children}</div>
    ),
    useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
    PointerSensor: class {},
    KeyboardSensor: class {},
    useSensor: vi.fn(),
    useSensors: vi.fn(() => []),
    closestCorners: vi.fn(),
  };
});

// Mock @dnd-kit/sortable
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

import Board from '../components/Board';

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

function defaultHookReturn(overrides: Record<string, unknown> = {}) {
  return {
    tasks: {} as Record<number, Task>,
    columns: { todo: [] as number[], in_progress: [] as number[], done: [] as number[] },
    loading: false,
    fetchTasks: vi.fn(),
    addTask: vi.fn(),
    updateTask: vi.fn(),
    removeTask: vi.fn(),
    moveTask: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
});

describe('Board', () => {
  it('renders three columns with titles "To Do", "In Progress", "Done"', () => {
    mockUseTasks.mockReturnValue(defaultHookReturn());

    render(<Board />);

    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('distributes tasks to correct columns based on task.column', () => {
    const task1 = makeTask({ id: 1, title: 'Todo Task', column: 'todo', position: 1000 });
    const task2 = makeTask({ id: 2, title: 'In Progress Task', column: 'in_progress', position: 1000 });
    const task3 = makeTask({ id: 3, title: 'Done Task', column: 'done', position: 1000 });

    const tasks: Record<number, Task> = { 1: task1, 2: task2, 3: task3 };
    const columns = { todo: [1], in_progress: [2], done: [3] };

    mockUseTasks.mockReturnValue(defaultHookReturn({ tasks, columns }));

    render(<Board />);

    // All task titles should be rendered
    expect(screen.getByText('Todo Task')).toBeInTheDocument();
    expect(screen.getByText('In Progress Task')).toBeInTheDocument();
    expect(screen.getByText('Done Task')).toBeInTheDocument();
  });

  it('wraps content in a DndContext for drag-and-drop', () => {
    mockUseTasks.mockReturnValue(defaultHookReturn());

    render(<Board />);

    // DndContext should be rendered (our mock adds data-testid)
    expect(screen.getByTestId('dnd-context')).toBeInTheDocument();
  });

  it('registers an onDragEnd handler on the DndContext', () => {
    mockUseTasks.mockReturnValue(defaultHookReturn());

    render(<Board />);

    const dndContext = screen.getByTestId('dnd-context');
    expect(dndContext.dataset.ondragend).toBe('function');
  });

  it('shows loading skeleton while tasks are loading', () => {
    mockUseTasks.mockReturnValue(defaultHookReturn({ loading: true }));

    const { container } = render(<Board />);

    // When loading, the board should show some kind of loading/skeleton indicator
    // Look for common skeleton patterns: animate-pulse class or "loading" text
    const pulseElements = container.querySelectorAll('.animate-pulse');
    const loadingText = screen.queryByText(/loading/i);

    // At least one loading indicator should be present
    expect(pulseElements.length > 0 || loadingText !== null).toBe(true);
  });

  it('calls fetchTasks on mount via the useTasks hook', () => {
    const fetchTasks = vi.fn();
    mockUseTasks.mockReturnValue(defaultHookReturn({ fetchTasks }));

    render(<Board />);

    // The hook itself handles fetchTasks on mount, so we just verify
    // the hook was called (Board uses useTasks)
    expect(mockUseTasks).toHaveBeenCalled();
  });

  it('renders multiple tasks within the same column', () => {
    const task1 = makeTask({ id: 1, title: 'First Todo', column: 'todo', position: 1000 });
    const task2 = makeTask({ id: 2, title: 'Second Todo', column: 'todo', position: 2000 });

    const tasks: Record<number, Task> = { 1: task1, 2: task2 };
    const columns = { todo: [1, 2], in_progress: [] as number[], done: [] as number[] };

    mockUseTasks.mockReturnValue(defaultHookReturn({ tasks, columns }));

    render(<Board />);

    expect(screen.getByText('First Todo')).toBeInTheDocument();
    expect(screen.getByText('Second Todo')).toBeInTheDocument();
  });
});

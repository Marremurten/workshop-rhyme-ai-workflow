import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragStartEvent, DragOverEvent, DragEndEvent, CollisionDetection } from '@dnd-kit/core';
import useTasks from '../hooks/useTasks';
import * as api from '../api/client';
import Column from './Column';
import BoardHeader from './BoardHeader';
import EditTaskModal from './EditTaskModal';
import TaskCard from './TaskCard';
import Toast from './Toast';

type ColumnId = 'todo' | 'in_progress' | 'review' | 'done';

interface User {
  id: number;
  email: string;
  name: string;
}

interface Task {
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

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error';
}

const COLUMNS: { id: ColumnId; title: string }[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Done' },
];

interface BoardProps {
  userName: string;
  onLogout: () => void;
}

export default function Board({ userName, onLogout }: BoardProps) {
  const { tasks, columns, setTasks, setColumns, loading, fetchTasks, addTask, updateTask, removeTask, moveTask } = useTasks();
  const [users, setUsers] = useState<User[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const dragStartSnapshot = useRef<{ tasks: Record<number, Task>; columns: Record<ColumnId, number[]> } | null>(null);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    api.fetchUsers().then((data) => {
      setUsers((data as { users: User[] }).users);
    }).catch(() => {});
  }, []);

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, keyboardSensor);

  const collisionDetection: CollisionDetection = useCallback((args) => {
    // pointerWithin works reliably for dropping into containers (columns)
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    // Fall back to rectIntersection for edge cases
    return rectIntersection(args);
  }, []);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as number);
    dragStartSnapshot.current = { tasks: { ...tasks }, columns: { ...columns } };
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeTaskId = active.id as number;
    const overStr = String(over.id);

    setColumns((prev) => {
      // Find which column the active task is currently in
      let activeCol: ColumnId | undefined;
      for (const col of COLUMNS) {
        if (prev[col.id].includes(activeTaskId)) { activeCol = col.id; break; }
      }
      if (!activeCol) return prev;

      // Determine target column
      let targetCol: ColumnId;
      if (overStr.startsWith('column-')) {
        targetCol = overStr.replace('column-', '') as ColumnId;
      } else {
        const overId = over.id as number;
        let found: ColumnId | undefined;
        for (const col of COLUMNS) {
          if (prev[col.id].includes(overId)) { found = col.id; break; }
        }
        if (!found) return prev;
        targetCol = found;
      }

      const next = { ...prev };

      if (activeCol !== targetCol) {
        // Cross-column move
        next[activeCol] = next[activeCol].filter((id) => id !== activeTaskId);
        if (overStr.startsWith('column-')) {
          next[targetCol] = [...next[targetCol], activeTaskId];
        } else {
          const overIndex = next[targetCol].indexOf(over.id as number);
          const newCol = [...next[targetCol]];
          newCol.splice(overIndex >= 0 ? overIndex + 1 : newCol.length, 0, activeTaskId);
          next[targetCol] = newCol;
        }
      } else {
        // Within-column reorder
        if (overStr.startsWith('column-')) return prev;
        const oldIndex = next[targetCol].indexOf(activeTaskId);
        const newIndex = next[targetCol].indexOf(over.id as number);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
        const arr = [...next[targetCol]];
        arr.splice(oldIndex, 1);
        arr.splice(newIndex, 0, activeTaskId);
        next[targetCol] = arr;
      }

      columnsRef.current = next;
      return next;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);

    const activeTaskId = event.active.id as number;
    const snapshot = dragStartSnapshot.current;
    dragStartSnapshot.current = null;

    if (!snapshot) return;

    // Read final position from ref (always up to date)
    const cur = columnsRef.current;
    let finalColumn: ColumnId | undefined;
    let finalIndex = -1;
    for (const col of COLUMNS) {
      const idx = cur[col.id].indexOf(activeTaskId);
      if (idx !== -1) { finalColumn = col.id; finalIndex = idx; break; }
    }

    if (!finalColumn || finalIndex === -1) {
      setTasks(snapshot.tasks);
      setColumns(snapshot.columns);
      return;
    }

    // Check no-op
    const origColumn = Object.keys(snapshot.columns).find((col) =>
      snapshot.columns[col as ColumnId].includes(activeTaskId)
    ) as ColumnId | undefined;
    if (origColumn === finalColumn) {
      const origIndex = snapshot.columns[finalColumn].indexOf(activeTaskId);
      if (origIndex === finalIndex) {
        setTasks(snapshot.tasks);
        setColumns(snapshot.columns);
        return;
      }
    }

    // Revert to snapshot, then moveTask does optimistic update + API call
    setTasks(snapshot.tasks);
    setColumns(snapshot.columns);
    moveTask(activeTaskId, finalColumn, finalIndex);
  }

  function handleDragCancel() {
    setActiveId(null);
    if (dragStartSnapshot.current) {
      setTasks(dragStartSnapshot.current.tasks);
      setColumns(dragStartSnapshot.current.columns);
      dragStartSnapshot.current = null;
    }
  }

  async function handleAddTask(data: { title: string; column: string }) {
    try {
      await addTask(data);
      showToast('Task created', 'success');
    } catch {
      showToast('Failed to create task', 'error');
    }
  }

  async function handleSaveTask(id: number, data: Record<string, unknown>) {
    try {
      await updateTask(id, data);
      setEditingTask(null);
      showToast('Task updated', 'success');
    } catch {
      showToast('Failed to update task', 'error');
    }
  }

  async function handleDeleteTask(id: number) {
    try {
      await removeTask(id);
      setEditingTask(null);
      showToast('Task deleted', 'success');
    } catch {
      showToast('Failed to delete task', 'error');
    }
  }

  const activeTask = activeId != null ? tasks[activeId] : null;

  if (loading) {
    return (
      <div className="flex h-screen flex-col">
        <BoardHeader userName={userName} onRefresh={fetchTasks} onLogout={onLogout} />
        <div className="flex min-h-0 flex-1 gap-6 p-6">
          {COLUMNS.map((col) => (
            <div key={col.id} className="flex-1 space-y-3 rounded-lg bg-gray-800 p-4">
              <div className="h-6 w-24 animate-pulse rounded bg-gray-700" />
              <div className="h-16 animate-pulse rounded bg-gray-700" />
              <div className="h-16 animate-pulse rounded bg-gray-700" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <BoardHeader userName={userName} onRefresh={fetchTasks} onLogout={onLogout} />
      <div className="flex min-h-0 flex-1 gap-6 overflow-x-auto bg-gray-950 p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {COLUMNS.map((col) => {
            const columnTaskIds = columns[col.id] || [];
            const columnTasks = columnTaskIds
              .map((id) => tasks[id])
              .filter(Boolean);

            return (
              <Column
                key={col.id}
                id={col.id}
                title={col.title}
                tasks={columnTasks}
                users={users}
                onAddTask={handleAddTask}
                onEditTask={(task) => setEditingTask(task)}
              />
            );
          })}

          <DragOverlay>
            {activeTask ? (
              <TaskCard
                task={activeTask}
                users={users}
                onClick={() => {}}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {editingTask && (
        <EditTaskModal
          task={editingTask}
          users={users}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onClose={() => setEditingTask(null)}
        />
      )}

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

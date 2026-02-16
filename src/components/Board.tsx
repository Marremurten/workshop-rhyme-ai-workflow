import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import useTasks from '../hooks/useTasks';
import * as api from '../api/client';
import Column from './Column';
import BoardHeader from './BoardHeader';
import EditTaskModal from './EditTaskModal';
import Toast from './Toast';

type ColumnId = 'todo' | 'in_progress' | 'done';

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
  { id: 'done', title: 'Done' },
];

interface BoardProps {
  userName: string;
  onLogout: () => void;
}

export default function Board({ userName, onLogout }: BoardProps) {
  const { tasks, columns, loading, fetchTasks, addTask, updateTask, removeTask, moveTask } = useTasks();
  const [users, setUsers] = useState<User[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as number;
    const overId = String(over.id);

    let targetColumn: ColumnId | undefined;
    for (const col of COLUMNS) {
      if (overId.includes(col.id)) {
        targetColumn = col.id;
        break;
      }
    }

    if (targetColumn) {
      const targetIndex = columns[targetColumn].length;
      moveTask(taskId, targetColumn, targetIndex);
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

  if (loading) {
    return (
      <div>
        <BoardHeader userName={userName} onRefresh={fetchTasks} onLogout={onLogout} />
        <div className="flex gap-6 p-6">
          {COLUMNS.map((col) => (
            <div key={col.id} className="w-80 space-y-3 rounded-lg bg-gray-200 p-4">
              <div className="h-6 w-24 animate-pulse rounded bg-gray-300" />
              <div className="h-16 animate-pulse rounded bg-gray-300" />
              <div className="h-16 animate-pulse rounded bg-gray-300" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <BoardHeader userName={userName} onRefresh={fetchTasks} onLogout={onLogout} />
      <div className="flex gap-6 overflow-x-auto bg-gray-100 p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={handleDragEnd}
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

import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/client';

interface Task {
  id: number;
  title: string;
  description: string | null;
  column: 'todo' | 'in_progress' | 'review' | 'done';
  position: number;
  assignee_id: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

type ColumnId = 'todo' | 'in_progress' | 'review' | 'done';

const COLUMN_IDS: ColumnId[] = ['todo', 'in_progress', 'review', 'done'];

export function useTasks() {
  const [tasks, setTasks] = useState<Record<number, Task>>({});
  const [columns, setColumns] = useState<Record<ColumnId, number[]>>({
    todo: [],
    in_progress: [],
    review: [],
    done: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.fetchTasks();
      const taskList = (data as { tasks: Task[] }).tasks;
      const taskMap: Record<number, Task> = {};
      const colMap: Record<ColumnId, number[]> = { todo: [], in_progress: [], review: [], done: [] };

      for (const task of taskList) {
        taskMap[task.id] = task;
        if (colMap[task.column]) {
          colMap[task.column].push(task.id);
        }
      }

      // Sort each column by position
      for (const col of COLUMN_IDS) {
        colMap[col].sort((a, b) => taskMap[a].position - taskMap[b].position);
      }

      setTasks(taskMap);
      setColumns(colMap);
    } finally {
      setLoading(false);
    }
  }, []);

  const addTask = useCallback(async (data: Record<string, unknown>) => {
    const result = await api.createTask(data);
    const task = (result as { task: Task }).task;
    setTasks((prev) => ({ ...prev, [task.id]: task }));
    setColumns((prev) => ({
      ...prev,
      [task.column]: [...prev[task.column], task.id],
    }));
  }, []);

  const updateTask = useCallback(async (id: number, data: Record<string, unknown>) => {
    const result = await api.updateTask(id, data);
    const task = (result as { task: Task }).task;
    setTasks((prev) => ({ ...prev, [task.id]: task }));
  }, []);

  const removeTask = useCallback(async (id: number) => {
    const task = tasks[id];
    await api.deleteTask(id);
    setTasks((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (task) {
      setColumns((prev) => ({
        ...prev,
        [task.column]: prev[task.column].filter((tid) => tid !== id),
      }));
    }
  }, [tasks]);

  const moveTask = useCallback(async (id: number, column: ColumnId, index: number) => {
    // Optimistic update
    const prevTasks = tasks;
    const prevColumns = columns;
    const task = tasks[id];
    if (!task) return;

    const oldColumn = task.column;

    setTasks((prev) => ({
      ...prev,
      [id]: { ...prev[id], column },
    }));

    setColumns((prev) => {
      const next = { ...prev };
      // Remove from old column
      next[oldColumn] = next[oldColumn].filter((tid) => tid !== id);
      // Insert into new column at index
      const newCol = [...next[column]];
      newCol.splice(index, 0, id);
      next[column] = newCol;
      return next;
    });

    try {
      await api.moveTask(id, column, index);
    } catch {
      // Revert on failure
      setTasks(prevTasks);
      setColumns(prevColumns);
      await fetchTasks();
    }
  }, [tasks, columns, fetchTasks]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return { tasks, columns, setTasks, setColumns, loading, fetchTasks, addTask, updateTask, removeTask, moveTask };
}

export default useTasks;

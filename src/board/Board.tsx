import { useState, useEffect } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import type { Task, User } from "../../shared/types";
import { COLUMNS } from "../constants";
import useTasks from "./useTasks";
import { useBoardDragDrop } from "./useBoardDragDrop";
import { useToast } from "./useToast";
import * as api from "../api/client";
import Column from "./Column";
import BoardHeader from "./BoardHeader";
import EditTaskModal from "./EditTaskModal";
import TaskCard from "./TaskCard";
import Toast from "./Toast";

interface BoardProps {
  userName: string;
  onLogout: () => void;
}

export default function Board({ userName, onLogout }: BoardProps) {
  const {
    tasks,
    columns,
    setTasks,
    setColumns,
    loading,
    fetchTasks,
    addTask,
    updateTask,
    removeTask,
    moveTask,
  } = useTasks();
  const [users, setUsers] = useState<User[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const { toasts, showToast, dismissToast } = useToast();
  const {
    sensors,
    collisionDetection,
    activeTask,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useBoardDragDrop({ tasks, columns, setTasks, setColumns, moveTask });

  useEffect(() => {
    api
      .fetchUsers()
      .then((data) => {
        setUsers((data as { users: User[] }).users);
      })
      .catch(() => {});
  }, []);

  async function handleAddTask(data: { title: string; column: string }) {
    try {
      await addTask(data);
      showToast("Task created", "success");
    } catch {
      showToast("Failed to create task", "error");
    }
  }

  async function handleSaveTask(id: number, data: Record<string, unknown>) {
    try {
      await updateTask(id, data);
      setEditingTask(null);
      showToast("Task updated", "success");
    } catch {
      showToast("Failed to update task", "error");
    }
  }

  async function handleDeleteTask(id: number) {
    try {
      await removeTask(id);
      setEditingTask(null);
      showToast("Task deleted", "success");
    } catch {
      showToast("Failed to delete task", "error");
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen flex-col">
        <BoardHeader
          userName={userName}
          onRefresh={fetchTasks}
          onLogout={onLogout}
        />
        <div className="flex min-h-0 flex-1 gap-6 p-6">
          {COLUMNS.map((col) => (
            <div
              key={col.id}
              className="flex-1 space-y-3 rounded-lg bg-gray-800 p-4"
            >
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
      <BoardHeader
        userName={userName}
        onRefresh={fetchTasks}
        onLogout={onLogout}
      />
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

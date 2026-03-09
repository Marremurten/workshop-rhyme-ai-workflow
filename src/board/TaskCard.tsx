import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "../../shared/types";

const PRIORITY_CONFIG: Record<string, { label: string; colorClass: string }> = {
  high: { label: "High", colorClass: "bg-red-900/50 text-red-300" },
  medium: { label: "Medium", colorClass: "bg-yellow-900/50 text-yellow-300" },
  low: { label: "Low", colorClass: "bg-green-900/50 text-green-300" },
};

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  users?: Array<{ id: number; name: string }>;
  isOverlay?: boolean;
}

const TaskCard = React.memo(function TaskCard({
  task,
  onClick,
  users,
  isOverlay,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const assignee =
    task.assignee_id != null && users
      ? users.find((u) => u.id === task.assignee_id)
      : undefined;

  return (
    <div
      ref={setNodeRef}
      style={isOverlay ? undefined : style}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      onClick={isDragging ? undefined : onClick}
      className={`cursor-pointer rounded-lg bg-gray-800 p-3 shadow-sm hover:shadow-lg hover:shadow-black/20 ${
        isDragging ? "opacity-30" : ""
      } ${isOverlay ? "rotate-2 shadow-xl shadow-black/30" : ""}`}
    >
      {PRIORITY_CONFIG[task.priority] && (
        <span
          className={`mb-2 inline-block rounded-full px-2 py-0.5 text-xs ${PRIORITY_CONFIG[task.priority].colorClass}`}
        >
          {PRIORITY_CONFIG[task.priority].label}
        </span>
      )}
      <p className="font-medium text-white">{task.title}</p>
      {task.description != null && (
        <p className="mt-1 line-clamp-1 text-sm text-gray-500">
          {task.description}
        </p>
      )}
      {assignee && (
        <span className="mt-2 inline-block rounded-full bg-blue-900/50 px-2 py-0.5 text-xs text-blue-300">
          {assignee.name}
        </span>
      )}
    </div>
  );
});

export default TaskCard;

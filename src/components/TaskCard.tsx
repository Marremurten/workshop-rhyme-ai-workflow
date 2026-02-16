import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  users?: Array<{ id: number; name: string }>;
}

const TaskCard = React.memo(function TaskCard({ task, onClick, users }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task.id });

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
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="cursor-pointer rounded-lg bg-white p-3 shadow-sm hover:shadow-md"
    >
      <p className="font-medium text-gray-900">{task.title}</p>
      {task.description != null && (
        <p className="mt-1 line-clamp-1 text-sm text-gray-500">{task.description}</p>
      )}
      {assignee && (
        <span className="mt-2 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
          {assignee.name}
        </span>
      )}
    </div>
  );
});

export default TaskCard;

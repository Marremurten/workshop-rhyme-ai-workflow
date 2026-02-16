import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task } from '../types';
import TaskCard from './TaskCard';
import CreateTaskForm from './CreateTaskForm';

interface ColumnProps {
  id: string;
  title: string;
  tasks: Task[];
  users?: Array<{ id: number; name: string }>;
  onAddTask: (data: { title: string; column: string }) => void;
  onEditTask: (task: Task) => void;
}

export default function Column({ id, title, tasks, users, onAddTask, onEditTask }: ColumnProps) {
  const { setNodeRef } = useDroppable({ id: `column-${id}` });

  return (
    <div ref={setNodeRef} className="flex min-w-0 flex-1 flex-col rounded-lg bg-gray-800/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold text-white">{title}</h2>
        <span className="rounded-full bg-gray-700 px-2 text-sm text-gray-300">
          {tasks.length}
        </span>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {tasks.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">No tasks yet</p>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                users={users}
                onClick={() => onEditTask(task)}
              />
            ))
          )}
        </div>
      </SortableContext>

      <CreateTaskForm column={id} onSubmit={onAddTask} />
    </div>
  );
}

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

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

interface ColumnProps {
  id: string;
  title: string;
  tasks: Task[];
  onAddTask: (data: { title: string; column: string }) => void;
  onEditTask: (task: Task) => void;
}

export default function Column({ id, title, tasks, onAddTask, onEditTask }: ColumnProps) {
  const { setNodeRef } = useDroppable({ id: `column-${id}` });

  return (
    <div ref={setNodeRef} className="w-80 shrink-0 rounded-lg bg-gray-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold text-gray-800">{title}</h2>
        <span className="rounded-full bg-gray-300 px-2 text-sm text-gray-700">
          {tasks.length}
        </span>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="min-h-[2rem] space-y-2">
          {tasks.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No tasks yet</p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="cursor-pointer rounded bg-white p-3 shadow-sm hover:shadow"
                onClick={() => onEditTask(task)}
              >
                {task.title}
              </div>
            ))
          )}
        </div>
      </SortableContext>

      <button
        onClick={() => onAddTask({ title: '', column: id })}
        className="mt-3 w-full rounded py-1 text-sm text-gray-500 hover:bg-gray-300"
      >
        + Add a card
      </button>
    </div>
  );
}

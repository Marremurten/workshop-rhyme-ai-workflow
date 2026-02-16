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
import Column from './Column';

type ColumnId = 'todo' | 'in_progress' | 'done';

const COLUMNS: { id: ColumnId; title: string }[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'done', title: 'Done' },
];

export default function Board() {
  const { tasks, columns, loading, addTask, moveTask, updateTask } = useTasks();

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, keyboardSensor);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as number;
    const overId = String(over.id);

    // Determine target column from the over id
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

  if (loading) {
    return (
      <div className="flex gap-6 p-6">
        {COLUMNS.map((col) => (
          <div key={col.id} className="w-80 space-y-3 rounded-lg bg-gray-200 p-4">
            <div className="h-6 w-24 animate-pulse rounded bg-gray-300" />
            <div className="h-16 animate-pulse rounded bg-gray-300" />
            <div className="h-16 animate-pulse rounded bg-gray-300" />
          </div>
        ))}
      </div>
    );
  }

  return (
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
              onAddTask={({ title, column }) =>
                addTask({ title, column })
              }
              onEditTask={(task) => updateTask(task.id, {})}
            />
          );
        })}
      </DndContext>
    </div>
  );
}

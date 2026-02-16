# @dnd-kit Kanban Board Patterns

## Summary

Building a kanban board with @dnd-kit requires three packages (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`) and follows a well-established pattern: a single `DndContext` wrapping multiple `SortableContext` containers (one per column), with three event handlers (`onDragStart`, `onDragOver`, `onDragEnd`) managing item movement between and within columns. The `DragOverlay` component provides smooth drag animations by rendering a floating copy of the dragged item outside the normal DOM flow. For persisting card order to SQLite, the project's existing REAL-valued position column with midpoint insertion and auto-rebalance pattern is ideal and already proven in the codebase.

---

## 1. Overview / Recommended Approach

The recommended architecture for a @dnd-kit kanban board is:

1. **One `DndContext`** at the board level -- provides drag-and-drop context to all children.
2. **One `SortableContext` per column** -- each column manages its own sorted list of item IDs.
3. **`useSortable` hook on each card** -- makes cards both draggable and droppable.
4. **`DragOverlay`** -- renders a floating copy of the active card during drag for smooth visuals.
5. **`closestCorners` collision detection** -- best for stacked droppable containers (kanban columns).
6. **Three handlers**: `onDragStart` (track active item), `onDragOver` (move items between columns in real-time), `onDragEnd` (finalize position and persist to server).

The state model is a `Record<ColumnId, TaskId[]>` mapping column IDs to ordered arrays of task IDs. During drag, items are moved between arrays optimistically; on drop, the final state is persisted to the backend.

---

## 2. Package Setup

### Required Packages

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

| Package | Purpose |
|---------|---------|
| `@dnd-kit/core` | DndContext, DragOverlay, sensors, collision detection algorithms, useDroppable |
| `@dnd-kit/sortable` | SortableContext, useSortable, arrayMove, sorting strategies |
| `@dnd-kit/utilities` | CSS.Transform helper for converting transform objects to CSS strings |

### Key Imports

```typescript
// From @dnd-kit/core
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  closestCorners,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  UniqueIdentifier,
} from '@dnd-kit/core';

// From @dnd-kit/sortable
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';

// From @dnd-kit/utilities
import { CSS } from '@dnd-kit/utilities';
```

---

## 3. Core Code Patterns

### 3.1 Board Component (Top-Level Orchestrator)

This is the main component that sets up DndContext, manages column state, and handles all drag events.

```typescript
import { useState, useCallback, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

type ColumnId = 'todo' | 'in_progress' | 'done';
type TaskId = string;

interface Task {
  id: TaskId;
  title: string;
  description: string | null;
  column: ColumnId;
  position: number;
  assignee_id: string | null;
}

// State: mapping of column -> ordered task IDs
type ColumnItems = Record<ColumnId, TaskId[]>;

function KanbanBoard() {
  const [tasks, setTasks] = useState<Record<TaskId, Task>>({});
  const [columns, setColumns] = useState<ColumnItems>({
    todo: [],
    in_progress: [],
    done: [],
  });
  const [activeId, setActiveId] = useState<TaskId | null>(null);

  // Snapshot for cancel recovery
  const clonedColumns = useRef<ColumnItems | null>(null);

  // -- Sensors --
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // -- Helper: find which column contains a given ID --
  const findColumn = useCallback(
    (id: TaskId): ColumnId | undefined => {
      // Check if the id IS a column id (for dropping on empty columns)
      if (id in columns) return id as ColumnId;

      // Otherwise find which column contains this task
      return (Object.keys(columns) as ColumnId[]).find((col) =>
        columns[col].includes(id)
      );
    },
    [columns]
  );

  // -- onDragStart: snapshot state, track active item --
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      setActiveId(active.id as TaskId);
      // Clone current state so we can restore on cancel
      clonedColumns.current = { ...columns };
    },
    [columns]
  );

  // -- onDragOver: move items between columns in real-time --
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeColumn = findColumn(active.id as TaskId);
      const overColumn = findColumn(over.id as TaskId);

      if (!activeColumn || !overColumn || activeColumn === overColumn) {
        return;
      }

      // Move item from activeColumn to overColumn
      setColumns((prev) => {
        const activeItems = [...prev[activeColumn]];
        const overItems = [...prev[overColumn]];

        const activeIndex = activeItems.indexOf(active.id as TaskId);
        // Where to insert in the target column
        const overIndex = overItems.indexOf(over.id as TaskId);

        // Remove from source
        activeItems.splice(activeIndex, 1);

        // Insert into destination
        // If dropping on a task, insert at that task's position
        // If dropping on the column itself, append to end
        const insertIndex =
          overIndex >= 0 ? overIndex : overItems.length;
        overItems.splice(insertIndex, 0, active.id as TaskId);

        return {
          ...prev,
          [activeColumn]: activeItems,
          [overColumn]: overItems,
        };
      });
    },
    [findColumn]
  );

  // -- onDragEnd: finalize reorder within a column, persist --
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      clonedColumns.current = null;

      if (!over) return;

      const activeColumn = findColumn(active.id as TaskId);
      const overColumn = findColumn(over.id as TaskId);

      if (!activeColumn || !overColumn) return;

      // Same column reorder
      if (activeColumn === overColumn) {
        const items = columns[activeColumn];
        const oldIndex = items.indexOf(active.id as TaskId);
        const newIndex = items.indexOf(over.id as TaskId);

        if (oldIndex !== newIndex) {
          setColumns((prev) => ({
            ...prev,
            [activeColumn]: arrayMove(prev[activeColumn], oldIndex, newIndex),
          }));
        }
      }

      // Persist the final position to the server
      // (both same-column reorder and cross-column move)
      const finalColumn = findColumn(active.id as TaskId)!;
      const finalItems = columns[finalColumn];
      const finalIndex = finalItems.indexOf(active.id as TaskId);

      persistTaskMove(active.id as TaskId, finalColumn, finalIndex);
    },
    [columns, findColumn]
  );

  // -- onDragCancel: restore snapshot --
  const handleDragCancel = useCallback(() => {
    if (clonedColumns.current) {
      setColumns(clonedColumns.current);
    }
    setActiveId(null);
    clonedColumns.current = null;
  }, []);

  const activeTask = activeId ? tasks[activeId] : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 p-4 h-full">
        <KanbanColumn
          id="todo"
          title="To Do"
          items={columns.todo}
          tasks={tasks}
        />
        <KanbanColumn
          id="in_progress"
          title="In Progress"
          items={columns.in_progress}
          tasks={tasks}
        />
        <KanbanColumn
          id="done"
          title="Done"
          items={columns.done}
          tasks={tasks}
        />
      </div>

      {/* DragOverlay must stay mounted -- render null inside when not dragging */}
      <DragOverlay>
        {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
```

### 3.2 Column Component (SortableContext + Droppable)

Each column wraps its items in a `SortableContext`. For empty columns, a `useDroppable` wrapper ensures items can still be dropped there.

```typescript
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';

interface KanbanColumnProps {
  id: string;
  title: string;
  items: TaskId[];
  tasks: Record<TaskId, Task>;
}

function KanbanColumn({ id, title, items, tasks }: KanbanColumnProps) {
  // useDroppable makes the column itself a drop target
  // This is critical for dropping into empty columns
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col w-80 bg-gray-100 rounded-lg p-3 ${
        isOver ? 'ring-2 ring-blue-400' : ''
      }`}
    >
      <h2 className="font-semibold text-lg mb-3">{title}</h2>

      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 min-h-[100px]">
          {items.map((taskId) => (
            <SortableTaskCard key={taskId} task={tasks[taskId]} />
          ))}
          {items.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">
              No tasks
            </p>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
```

**Key point:** The `useDroppable` on the column element with `id` matching the column key is essential. When `findColumn(id)` is called with this column ID, it resolves to the column itself, allowing drops on empty columns.

### 3.3 Sortable Task Card (useSortable)

Each task card uses the `useSortable` hook to be both draggable and a drop target.

```typescript
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableTaskCardProps {
  task: Task;
}

function SortableTaskCard({ task }: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1, // Dim the original while dragging
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white rounded-md shadow-sm p-3 border border-gray-200 cursor-grab active:cursor-grabbing"
    >
      <h3 className="font-medium text-sm">{task.title}</h3>
      {task.description && (
        <p className="text-gray-500 text-xs mt-1 line-clamp-2">
          {task.description}
        </p>
      )}
      {task.assignee_id && (
        <div className="mt-2 text-xs text-gray-400">
          Assigned to: {task.assignee_id}
        </div>
      )}
    </div>
  );
}
```

### 3.4 Drag Overlay Component (Presentational Only)

The DragOverlay renders a **separate** presentational component -- never reuse the same `useSortable` component inside DragOverlay, as the duplicate ID causes unexpected behavior.

```typescript
// This is a pure presentational component -- no hooks
function TaskCardOverlay({ task }: { task: Task }) {
  return (
    <div className="bg-white rounded-md shadow-lg p-3 border-2 border-blue-400 cursor-grabbing rotate-2 scale-105">
      <h3 className="font-medium text-sm">{task.title}</h3>
      {task.description && (
        <p className="text-gray-500 text-xs mt-1 line-clamp-2">
          {task.description}
        </p>
      )}
    </div>
  );
}
```

**Critical rule:** The `DragOverlay` component should remain mounted at all times. Conditionally render `null` *inside* it, not the `DragOverlay` itself. If you conditionally render the `DragOverlay` component, drop animations will not work.

```typescript
// CORRECT - DragOverlay always mounted, content conditional
<DragOverlay>
  {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
</DragOverlay>

// WRONG - DragOverlay conditionally mounted, breaks drop animation
{activeTask && (
  <DragOverlay>
    <TaskCardOverlay task={activeTask} />
  </DragOverlay>
)}
```

### 3.5 Custom Collision Detection (Recommended for Kanban)

The built-in `closestCorners` works well for most kanban boards. However, for more precise behavior, combine `pointerWithin` (high precision) with `closestCorners` (fallback for keyboard sensor):

```typescript
import {
  pointerWithin,
  closestCorners,
  CollisionDetection,
} from '@dnd-kit/core';

const kanbanCollisionDetection: CollisionDetection = (args) => {
  // First try pointer-based detection (most precise for mouse/touch)
  const pointerCollisions = pointerWithin(args);

  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }

  // Fall back to closestCorners (works with keyboard sensor)
  return closestCorners(args);
};

// Usage:
<DndContext collisionDetection={kanbanCollisionDetection} ... >
```

**Why `closestCorners` over `closestCenter` for kanban:**
When droppable containers are stacked vertically (as in kanban columns), `closestCenter` can return the underlying column droppable rather than a specific card within the column. `closestCorners` calculates distance from all four corners, yielding results more aligned with visual expectations.

| Algorithm | Best For | Kanban Suitability |
|-----------|----------|-------------------|
| `closestCenter` | Simple flat lists | Poor -- misidentifies stacked containers |
| `closestCorners` | Stacked/nested containers | Good -- default choice for kanban |
| `rectIntersection` | Large drop zones | Fair -- less precise for small cards |
| `pointerWithin` | Mouse/touch only | Excellent precision, but no keyboard support |
| Custom (pointer + corners) | Kanban with accessibility | Best -- precise + keyboard fallback |

---

## 4. Position Persistence Strategy

### Recommendation: REAL-valued position with midpoint insertion

This project's existing database already uses `REAL`-valued `position` columns with midpoint insertion and auto-rebalance when the gap falls below 0.001. This is the recommended approach for the kanban board.

### How It Works

1. Each task has a `position REAL` column and a `column TEXT` column.
2. Tasks are ordered by `position ASC` within each column.
3. When inserting between two tasks, the new position = average of neighbors.
4. When the gap between adjacent positions falls below a threshold (0.001), all positions in that column are rebalanced to integers (1.0, 2.0, 3.0, ...).

### Position Calculation on Move

```typescript
// Calculate new position based on surrounding items
function calculateNewPosition(
  items: Task[],         // all tasks in the destination column, sorted by position
  destinationIndex: number  // where the moved task should end up
): number {
  if (items.length === 0) {
    return 1.0; // First item in empty column
  }

  if (destinationIndex === 0) {
    // Insert at beginning -- half of first item's position
    return items[0].position / 2;
  }

  if (destinationIndex >= items.length) {
    // Insert at end -- last position + 1
    return items[items.length - 1].position + 1.0;
  }

  // Insert between two items -- midpoint
  const before = items[destinationIndex - 1].position;
  const after = items[destinationIndex].position;
  return (before + after) / 2;
}
```

### API Call on Drop

```typescript
async function persistTaskMove(
  taskId: string,
  newColumn: ColumnId,
  newIndex: number
) {
  // Get the current ordered tasks in the destination column
  // (excluding the moved task itself)
  const columnTasks = columns[newColumn]
    .filter((id) => id !== taskId)
    .map((id) => tasks[id])
    .sort((a, b) => a.position - b.position);

  const newPosition = calculateNewPosition(columnTasks, newIndex);

  await fetch(`/api/tasks/${taskId}/move`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      column: newColumn,
      position: newPosition,
    }),
  });
}
```

### Server-Side Rebalance (When Gap Is Too Small)

```sql
-- Check if rebalance is needed after inserting
-- If min gap between adjacent positions < 0.001, rebalance the whole column

-- Rebalance: renumber all positions in a column as 1.0, 2.0, 3.0, ...
UPDATE tasks
SET position = CASE id
  WHEN 'id-1' THEN 1.0
  WHEN 'id-2' THEN 2.0
  WHEN 'id-3' THEN 3.0
  -- ... etc
END
WHERE column = 'todo';
```

### Comparison of Strategies

| Strategy | Writes per Move | Precision | Complexity | Recommendation |
|----------|----------------|-----------|------------|----------------|
| **REAL midpoint (current)** | 1 (+ occasional N rebalance) | ~52 splits before rebalance | Low | **Use this** -- already in codebase |
| Fractional indexing (strings) | 1 | Unlimited | Medium | Overkill for non-realtime app |
| Integer with gap (e.g., 16384) | 1 (+ rare N rebalance) | Needs wider gaps | Low | Similar to REAL midpoint |
| Re-index all on every move | N | Perfect | Low | Too many writes per drag |

The REAL midpoint approach is ideal because:
- Only 1 row updated per move (the moved task).
- Rebalance is rare (only after ~52 consecutive bisections in the same gap).
- Already implemented and proven in this project's codebase.
- Simple to understand and debug.

---

## 5. Gotchas and Tips

### Critical Gotchas

1. **Do not render `useSortable` components inside `DragOverlay`.** The duplicate `id` causes conflicts. Always create a separate presentational component for the overlay.

2. **Keep `DragOverlay` always mounted.** Conditionally render `null` inside it, not the component itself. Unmounting `DragOverlay` breaks the drop animation.

3. **Empty columns need `useDroppable`.** If all items are dragged out of a column, `SortableContext` alone has no drop targets. The column element must also be a droppable (via `useDroppable` with the column's ID) to accept items back.

4. **`SortableContext` items must match render order.** The `items` array passed to `SortableContext` must be sorted in the same order as the rendered children. Mismatches cause visual glitches.

5. **Use `distance` activation constraint on PointerSensor.** Without it, any click triggers a drag. A distance of 5-10px prevents accidental drags while allowing clicks on card buttons/links:
   ```typescript
   useSensor(PointerSensor, {
     activationConstraint: { distance: 8 },
   })
   ```

6. **Clone state on drag start for cancel recovery.** Store a snapshot of `columns` in a ref when drag starts. If the user cancels (e.g., pressing Escape), restore the snapshot in `onDragCancel`.

7. **`handleDragOver` fires frequently.** It runs on every pointer move over a new droppable. Keep it efficient -- avoid API calls here. Only persist on `handleDragEnd`.

### Performance Tips

- **Memoize task cards** with `React.memo` to prevent re-renders of non-affected cards during drag.
- **Use `isDragging` from `useSortable`** to set `opacity: 0.5` on the original item, giving visual feedback that it has been "picked up."
- **Use `CSS.Transform.toString(transform)`** instead of manually constructing CSS transform strings -- it handles null/undefined gracefully.

### Accessibility

- **Include `KeyboardSensor`** alongside `PointerSensor` for keyboard users.
- **`sortableKeyboardCoordinates`** from `@dnd-kit/sortable` provides sensible defaults for keyboard navigation in sortable lists.
- **Custom screen reader instructions** can be set via the `screenReaderInstructions` prop on `DndContext`.
- The `attributes` spread from `useSortable` includes `role`, `tabIndex`, and `aria-*` attributes automatically.

### Data Flow Summary

```
User drags card
  -> onDragStart: save activeId, clone state
  -> onDragOver (repeated): move item between column arrays (optimistic UI)
  -> onDragEnd: finalize array positions, calculate REAL position, PATCH /api/tasks/:id/move
  -> Server: update task row (column + position), rebalance if needed
  -> onDragCancel (if ESC): restore cloned state
```

### Sensor Configuration Reference

```typescript
const sensors = useSensors(
  useSensor(PointerSensor, {
    // Require 8px of movement before drag starts
    // This allows clicks on buttons/links inside cards
    activationConstraint: {
      distance: 8,
    },
  }),
  useSensor(KeyboardSensor, {
    // Use sortable-aware coordinate getter for arrow keys
    coordinateGetter: sortableKeyboardCoordinates,
  })
);
```

---

## Open Questions

1. **Optimistic update rollback on server error.** If the PATCH request to persist a move fails, should we roll back the UI state? The current pattern does not address this. Recommendation: show an error toast and refetch the board state from the server.

2. **Concurrent edits.** If two users move the same card simultaneously, the second write wins (last-write-wins). The PRD says "refresh to see changes" (no real-time sync), so this is acceptable. The existing `version` field on tasks could be used for optimistic concurrency control if needed later.

3. **Touch device support.** The PointerSensor handles touch events natively (pointer events unify mouse/touch/pen). The `distance: 8` activation constraint works for touch. However, long-press behavior may need tuning if mobile support becomes important (currently out of scope per PRD).

4. **Column drag (reordering columns).** The PRD specifies fixed columns (To Do, In Progress, Done), so column dragging is not needed. If this changes, each column would also become a sortable item in a horizontal `SortableContext`.

---

## Sources

- [dnd-kit Official Documentation](https://docs.dndkit.com/)
- [Sortable Preset Documentation](https://docs.dndkit.com/presets/sortable)
- [useSortable Hook Documentation](https://docs.dndkit.com/presets/sortable/usesortable)
- [Collision Detection Algorithms](https://docs.dndkit.com/api-documentation/context-provider/collision-detection-algorithms)
- [DragOverlay Documentation](https://docs.dndkit.com/api-documentation/draggable/drag-overlay)
- [dnd-kit MultipleContainers.tsx (Official Example)](https://github.com/clauderic/dnd-kit/blob/master/stories/2%20-%20Presets/Sortable/MultipleContainers.tsx)
- [DeepWiki: dnd-kit Multiple Containers](https://deepwiki.com/clauderic/dnd-kit/4.4-multiple-containers)
- [LogRocket: Build a Kanban Board with dnd-kit](https://blog.logrocket.com/build-kanban-board-dnd-kit-react/)
- [Radzion: Building a Drag-and-Drop Kanban Board](https://radzion.com/blog/kanban/)
- [Chetan Verma: Kanban Board Using dnd-kit](https://www.chetanverma.com/blog/how-to-create-an-awesome-kanban-board-using-dnd-kit)
- [Plaintext Engineering: Drag and Drop Kanban Board](https://plaintext-engineering.com/blog/drag-n-drop-kanban-board-react/)
- [Figma Blog: Realtime Editing of Ordered Sequences](https://www.figma.com/blog/realtime-editing-of-ordered-sequences/)
- [Steve Ruiz: Reordering with Fractional Indices](https://www.steveruiz.me/posts/reordering-fractional-indices)
- [Basedash: Implementing Re-Ordering at the Database Level](https://www.basedash.com/blog/implementing-re-ordering-at-the-database-level-our-experience)

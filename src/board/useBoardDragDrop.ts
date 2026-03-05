import { useState, useCallback, useRef, useEffect } from "react";
import {
  pointerWithin,
  rectIntersection,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type {
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  CollisionDetection,
} from "@dnd-kit/core";
import type { Task, ColumnId } from "../../shared/types";
import { findTaskColumn } from "./findTaskColumn";

interface UseBoardDragDropArgs {
  tasks: Record<number, Task>;
  columns: Record<ColumnId, number[]>;
  setTasks: React.Dispatch<React.SetStateAction<Record<number, Task>>>;
  setColumns: React.Dispatch<React.SetStateAction<Record<ColumnId, number[]>>>;
  moveTask: (id: number, column: ColumnId, index: number) => void;
}

export function useBoardDragDrop({
  tasks,
  columns,
  setTasks,
  setColumns,
  moveTask,
}: UseBoardDragDropArgs) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const dragStartSnapshot = useRef<{
    tasks: Record<number, Task>;
    columns: Record<ColumnId, number[]>;
  } | null>(null);
  const columnsRef = useRef(columns);
  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, keyboardSensor);

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return rectIntersection(args);
  }, []);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as number);
    dragStartSnapshot.current = {
      tasks: { ...tasks },
      columns: { ...columns },
    };
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeTaskId = active.id as number;
    const overStr = String(over.id);

    setColumns((prev) => {
      const activeCol = findTaskColumn(prev, activeTaskId);
      if (!activeCol) return prev;

      let targetCol: ColumnId;
      if (overStr.startsWith("column-")) {
        targetCol = overStr.replace("column-", "") as ColumnId;
      } else {
        const overId = over.id as number;
        const found = findTaskColumn(prev, overId);
        if (!found) return prev;
        targetCol = found;
      }

      const next = { ...prev };

      if (activeCol !== targetCol) {
        next[activeCol] = next[activeCol].filter((id) => id !== activeTaskId);
        if (overStr.startsWith("column-")) {
          next[targetCol] = [...next[targetCol], activeTaskId];
        } else {
          const overIndex = next[targetCol].indexOf(over.id as number);
          const newCol = [...next[targetCol]];
          newCol.splice(
            overIndex >= 0 ? overIndex + 1 : newCol.length,
            0,
            activeTaskId,
          );
          next[targetCol] = newCol;
        }
      } else {
        if (overStr.startsWith("column-")) return prev;
        const oldIndex = next[targetCol].indexOf(activeTaskId);
        const newIndex = next[targetCol].indexOf(over.id as number);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex)
          return prev;
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

    const cur = columnsRef.current;
    const finalColumn = findTaskColumn(cur, activeTaskId);
    let finalIndex = -1;
    if (finalColumn) {
      finalIndex = cur[finalColumn].indexOf(activeTaskId);
    }

    if (!finalColumn || finalIndex === -1) {
      setTasks(snapshot.tasks);
      setColumns(snapshot.columns);
      return;
    }

    const origColumn = findTaskColumn(snapshot.columns, activeTaskId);
    if (origColumn === finalColumn) {
      const origIndex = snapshot.columns[finalColumn].indexOf(activeTaskId);
      if (origIndex === finalIndex) {
        setTasks(snapshot.tasks);
        setColumns(snapshot.columns);
        return;
      }
    }

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

  const activeTask = activeId != null ? tasks[activeId] : null;

  return {
    sensors,
    collisionDetection,
    activeId,
    activeTask,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}

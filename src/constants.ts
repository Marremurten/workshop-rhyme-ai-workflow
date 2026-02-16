import type { ColumnId } from "./types";

export const COLUMNS: { id: ColumnId; title: string }[] = [
  { id: "todo", title: "To Do" },
  { id: "in_progress", title: "In Progress" },
  { id: "review", title: "Review" },
  { id: "done", title: "Done" },
];

export const COLUMN_IDS: ColumnId[] = COLUMNS.map((c) => c.id);

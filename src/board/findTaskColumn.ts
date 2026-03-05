import type { ColumnId } from "../../shared/types";
import { COLUMNS } from "../constants";

export function findTaskColumn(
  columns: Record<ColumnId, number[]>,
  taskId: number,
): ColumnId | undefined {
  for (const col of COLUMNS) {
    if (columns[col.id].includes(taskId)) return col.id;
  }
  return undefined;
}

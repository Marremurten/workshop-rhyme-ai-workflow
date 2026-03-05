export type { ColumnId, Task, User } from "../shared/types";

export interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "error";
}

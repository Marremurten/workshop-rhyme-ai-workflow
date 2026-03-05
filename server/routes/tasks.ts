import { Router } from "express";
import type { Response } from "express";
import type Database from "better-sqlite3";
import { requireAuth } from "../middleware/auth";
import type { AuthenticatedRequest } from "../types";
import type { Task } from "../../shared/types";

const POSITION_INCREMENT = 1000;

function getTaskById(
  db: Database.Database,
  id: string | number | bigint,
): Task | undefined {
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as
    | Task
    | undefined;
}

export function createTasksRouter(db: Database.Database): Router {
  const router = Router();

  // All task routes require auth
  router.use(requireAuth);

  // GET /api/tasks
  router.get("/", (_req: Request, res: Response) => {
    const tasks = db
      .prepare('SELECT * FROM tasks ORDER BY "column", position ASC')
      .all() as Task[];
    res.json({ tasks });
  });

  // POST /api/tasks
  router.post("/", (req: Request, res: Response) => {
    const { title, description, column: col } = req.body;

    if (!title) {
      res.status(400).json({ error: "Title is required" });
      return;
    }

    const targetColumn = col || "todo";
    const userId = (req as AuthenticatedRequest).userId;

    // Calculate position: max position in column + 1000, or 1000 if empty
    const maxRow = db
      .prepare('SELECT MAX(position) as maxPos FROM tasks WHERE "column" = ?')
      .get(targetColumn) as { maxPos: number | null } | undefined;

    const position = (maxRow?.maxPos ?? 0) + POSITION_INCREMENT;

    const result = db
      .prepare(
        'INSERT INTO tasks (title, description, "column", position, created_by) VALUES (?, ?, ?, ?, ?)',
      )
      .run(title, description ?? null, targetColumn, position, userId);

    const task = getTaskById(db, result.lastInsertRowid);
    res.status(201).json({ task });
  });

  // PUT /api/tasks/:id
  router.put("/:id", (req: Request, res: Response) => {
    const { id } = req.params;

    const existing = getTaskById(db, id);
    if (!existing) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    const { title, description, assignee_id, column: col } = req.body;

    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (title !== undefined) {
      fields.push("title = ?");
      values.push(title);
    }
    if (description !== undefined) {
      fields.push("description = ?");
      values.push(description);
    }
    if (assignee_id !== undefined) {
      fields.push("assignee_id = ?");
      values.push(assignee_id);
    }
    if (col !== undefined) {
      fields.push('"column" = ?');
      values.push(col);
    }

    fields.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(id);

    db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).run(
      ...values,
    );

    const task = getTaskById(db, id);
    res.json({ task });
  });

  // DELETE /api/tasks/:id
  router.delete("/:id", (req: Request, res: Response) => {
    const { id } = req.params;

    const existing = getTaskById(db, id);
    if (!existing) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    res.json({ message: "Task deleted" });
  });

  // PATCH /api/tasks/:id/move
  router.patch("/:id/move", (req: Request, res: Response) => {
    const { id } = req.params;

    const existing = getTaskById(db, id);
    if (!existing) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    const { column: targetColumn, index } = req.body;

    // Get all OTHER tasks in the target column, ordered by position
    const otherTasks = db
      .prepare(
        'SELECT * FROM tasks WHERE "column" = ? AND id != ? ORDER BY position ASC',
      )
      .all(targetColumn, id) as Task[];

    let newPosition: number;

    if (otherTasks.length === 0) {
      // Empty column
      newPosition = POSITION_INCREMENT;
    } else if (index === 0) {
      // Start of column
      newPosition = otherTasks[0].position / 2;
    } else if (index >= otherTasks.length) {
      // End of column
      newPosition = otherTasks[otherTasks.length - 1].position + POSITION_INCREMENT;
    } else {
      // Between two tasks
      newPosition =
        (otherTasks[index - 1].position + otherTasks[index].position) / 2;
    }

    db.prepare(
      "UPDATE tasks SET \"column\" = ?, position = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(targetColumn, newPosition, id);

    const task = getTaskById(db, id);
    res.json({ task });
  });

  return router;
}

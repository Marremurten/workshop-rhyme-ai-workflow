import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type Database from "better-sqlite3";
import { createTestApp, registerAndGetCookie } from "../test-helpers";

describe("Tasks API", () => {
  let app: Express;
  let db: Database.Database;
  let cookie: string;

  beforeEach(async () => {
    ({ app, db } = createTestApp());
    cookie = await registerAndGetCookie(app);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  // ---- GET /api/tasks ----

  describe("GET /api/tasks", () => {
    it("returns empty array initially", async () => {
      const res = await request(app).get("/api/tasks").set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body.tasks).toEqual([]);
    });

    it("returns tasks sorted by column then position", async () => {
      // Create tasks in different columns and positions
      await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "Todo 1" });

      await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "Done 1", column: "done" });

      await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "In Progress 1", column: "in_progress" });

      await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "Todo 2" });

      const res = await request(app).get("/api/tasks").set("Cookie", cookie);

      expect(res.status).toBe(200);
      const titles = res.body.tasks.map((t: { title: string }) => t.title);
      // Sorted by column (done, in_progress, todo alphabetically) then position
      expect(titles).toEqual(["Done 1", "In Progress 1", "Todo 1", "Todo 2"]);
    });

    it("requires auth (401 without cookie)", async () => {
      const res = await request(app).get("/api/tasks");

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Unauthorized" });
    });
  });

  // ---- POST /api/tasks ----

  describe("POST /api/tasks", () => {
    it("creates task with title and returns 201", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "My new task" });

      expect(res.status).toBe(201);
      expect(res.body.task).toBeDefined();
      expect(res.body.task.title).toBe("My new task");
      expect(res.body.task.id).toBeDefined();
      expect(res.body.task.created_at).toBeDefined();
      expect(res.body.task.updated_at).toBeDefined();
    });

    it('defaults column to "todo"', async () => {
      const res = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "Default column task" });

      expect(res.status).toBe(201);
      expect(res.body.task.column).toBe("todo");
    });

    it("auto-calculates position at end of column", async () => {
      const res1 = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "First task" });

      expect(res1.body.task.position).toBe(1000);

      const res2 = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "Second task" });

      expect(res2.body.task.position).toBe(2000);

      const res3 = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "Third task" });

      expect(res3.body.task.position).toBe(3000);
    });

    it("returns 400 when title is missing", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Title is required" });
    });

    it("sets created_by to authenticated user", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "Check creator" });

      expect(res.status).toBe(201);
      // The registered user should be user id 1 (first user in the db)
      expect(res.body.task.created_by).toBe(1);
    });
  });

  // ---- PUT /api/tasks/:id ----

  describe("PUT /api/tasks/:id", () => {
    let taskId: number;

    beforeEach(async () => {
      const res = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "Original title", description: "Original description" });

      taskId = res.body.task.id;
    });

    it("updates title", async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set("Cookie", cookie)
        .send({ title: "Updated title" });

      expect(res.status).toBe(200);
      expect(res.body.task.title).toBe("Updated title");
    });

    it("updates description", async () => {
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set("Cookie", cookie)
        .send({ description: "New description" });

      expect(res.status).toBe(200);
      expect(res.body.task.description).toBe("New description");
    });

    it("sets assignee_id", async () => {
      // Register a second user to use as assignee
      await request(app).post("/api/auth/register").send({
        email: "other@example.com",
        name: "Other User",
        password: "password123",
      });

      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set("Cookie", cookie)
        .send({ assignee_id: 2 });

      expect(res.status).toBe(200);
      expect(res.body.task.assignee_id).toBe(2);
    });

    it("clears assignee_id with null", async () => {
      // First set an assignee
      await request(app)
        .put(`/api/tasks/${taskId}`)
        .set("Cookie", cookie)
        .send({ assignee_id: 1 });

      // Then clear it
      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set("Cookie", cookie)
        .send({ assignee_id: null });

      expect(res.status).toBe(200);
      expect(res.body.task.assignee_id).toBeNull();
    });

    it("returns 404 for nonexistent id", async () => {
      const res = await request(app)
        .put("/api/tasks/99999")
        .set("Cookie", cookie)
        .send({ title: "Nope" });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Task not found" });
    });

    it("updates updated_at timestamp", async () => {
      const before = await request(app).get("/api/tasks").set("Cookie", cookie);

      const originalUpdatedAt = before.body.tasks[0].updated_at;

      // Small delay to ensure timestamp differs
      await new Promise((resolve) => setTimeout(resolve, 50));

      const res = await request(app)
        .put(`/api/tasks/${taskId}`)
        .set("Cookie", cookie)
        .send({ title: "Timestamp test" });

      expect(res.status).toBe(200);
      expect(res.body.task.updated_at).not.toBe(originalUpdatedAt);
    });
  });

  // ---- DELETE /api/tasks/:id ----

  describe("DELETE /api/tasks/:id", () => {
    it("deletes task and returns 200", async () => {
      const createRes = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "To be deleted" });

      const taskId = createRes.body.task.id;

      const res = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: "Task deleted" });

      // Verify it's actually gone
      const listRes = await request(app)
        .get("/api/tasks")
        .set("Cookie", cookie);

      expect(listRes.body.tasks).toHaveLength(0);
    });

    it("returns 404 for nonexistent id", async () => {
      const res = await request(app)
        .delete("/api/tasks/99999")
        .set("Cookie", cookie);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Task not found" });
    });
  });

  // ---- PATCH /api/tasks/:id/move ----

  describe("PATCH /api/tasks/:id/move", () => {
    it("moves task to a different column and updates column and position", async () => {
      const createRes = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "Moveable task" });

      const taskId = createRes.body.task.id;

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/move`)
        .set("Cookie", cookie)
        .send({ column: "in_progress", index: 0 });

      expect(res.status).toBe(200);
      expect(res.body.task.column).toBe("in_progress");
      expect(res.body.task.position).toBeDefined();
    });

    it("reorders within same column", async () => {
      // Create two tasks in todo
      await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "Task A" });

      const res2 = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "Task B" });

      const taskBId = res2.body.task.id;

      // Move Task B to index 0 (before Task A)
      const moveRes = await request(app)
        .patch(`/api/tasks/${taskBId}/move`)
        .set("Cookie", cookie)
        .send({ column: "todo", index: 0 });

      expect(moveRes.status).toBe(200);
      expect(moveRes.body.task.column).toBe("todo");

      // Verify order: Task B should now be before Task A
      const listRes = await request(app)
        .get("/api/tasks")
        .set("Cookie", cookie);

      const todoTasks = listRes.body.tasks.filter(
        (t: { column: string }) => t.column === "todo",
      );
      expect(todoTasks[0].title).toBe("Task B");
      expect(todoTasks[1].title).toBe("Task A");
    });

    it("moves to empty column and sets position 1000", async () => {
      const createRes = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "Move to empty" });

      const taskId = createRes.body.task.id;

      const res = await request(app)
        .patch(`/api/tasks/${taskId}/move`)
        .set("Cookie", cookie)
        .send({ column: "done", index: 0 });

      expect(res.status).toBe(200);
      expect(res.body.task.column).toBe("done");
      expect(res.body.task.position).toBe(1000);
    });

    it("moves to start of column (position = first/2)", async () => {
      // Create a task in in_progress
      await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "Existing task", column: "in_progress" });

      // Create a second task in todo
      const res2 = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "New task" });

      const newTaskId = res2.body.task.id;

      // Move new task to start of in_progress (index 0)
      const moveRes = await request(app)
        .patch(`/api/tasks/${newTaskId}/move`)
        .set("Cookie", cookie)
        .send({ column: "in_progress", index: 0 });

      expect(moveRes.status).toBe(200);
      expect(moveRes.body.task.column).toBe("in_progress");
      // First task has position 1000, so start should be 1000/2 = 500
      expect(moveRes.body.task.position).toBe(500);
    });

    it("moves to end of column (position = last + 1000)", async () => {
      // Create two tasks in in_progress
      await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "IP Task 1", column: "in_progress" });

      await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "IP Task 2", column: "in_progress" });

      // Create a task in todo
      const res3 = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "Move me" });

      const moveTaskId = res3.body.task.id;

      // Move to end of in_progress (index 2 = after both existing tasks)
      const moveRes = await request(app)
        .patch(`/api/tasks/${moveTaskId}/move`)
        .set("Cookie", cookie)
        .send({ column: "in_progress", index: 2 });

      expect(moveRes.status).toBe(200);
      expect(moveRes.body.task.column).toBe("in_progress");
      // IP Task 1 position=1000, IP Task 2 position=2000, end = 2000+1000 = 3000
      expect(moveRes.body.task.position).toBe(3000);
    });

    it("moves between two tasks and gets midpoint position", async () => {
      // Create three tasks in in_progress
      await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "IP Task 1", column: "in_progress" });

      await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "IP Task 2", column: "in_progress" });

      // Create a task in todo to move
      const res3 = await request(app)
        .post("/api/tasks")
        .set("Cookie", cookie)
        .send({ title: "Move between" });

      const moveTaskId = res3.body.task.id;

      // Move between IP Task 1 (pos 1000) and IP Task 2 (pos 2000) at index 1
      const moveRes = await request(app)
        .patch(`/api/tasks/${moveTaskId}/move`)
        .set("Cookie", cookie)
        .send({ column: "in_progress", index: 1 });

      expect(moveRes.status).toBe(200);
      expect(moveRes.body.task.column).toBe("in_progress");
      // Midpoint of 1000 and 2000 = 1500
      expect(moveRes.body.task.position).toBe(1500);
    });

    it("returns 404 for nonexistent id", async () => {
      const res = await request(app)
        .patch("/api/tasks/99999/move")
        .set("Cookie", cookie)
        .send({ column: "done", index: 0 });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Task not found" });
    });
  });
});

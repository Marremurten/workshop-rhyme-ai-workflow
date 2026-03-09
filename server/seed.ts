import { getDb } from "./db/index";
import bcrypt from "bcrypt";

const db = getDb();

// Create users
const hash = bcrypt.hashSync("password123", 10);

db.prepare(
  "INSERT OR IGNORE INTO users (email, name, password_hash) VALUES (?, ?, ?)",
).run("alice@example.com", "Alice", hash);
db.prepare(
  "INSERT OR IGNORE INTO users (email, name, password_hash) VALUES (?, ?, ?)",
).run("bob@example.com", "Bob", hash);
db.prepare(
  "INSERT OR IGNORE INTO users (email, name, password_hash) VALUES (?, ?, ?)",
).run("charlie@example.com", "Charlie", hash);

const alice = db
  .prepare("SELECT id FROM users WHERE email = ?")
  .get("alice@example.com") as { id: number };
const bob = db
  .prepare("SELECT id FROM users WHERE email = ?")
  .get("bob@example.com") as { id: number };

// Clear existing tasks
db.prepare("DELETE FROM tasks").run();

const tasks = [
  {
    title: "Build an AI workflow for the team",
    description:
      "Create a workflow for how to work with Claude Code to implement task 1 and task 2.",
    column: "todo",
    priority: "high",
    assignee_id: null,
    created_by: alice.id,
  },
  {
    title: "Task 1: Add task priority (Low/Medium/High)",
    description:
      "Full-stack: new column in DB, update API, priority picker in UI, color-coded cards.",
    column: "todo",
    priority: "medium",
    assignee_id: null,
    created_by: alice.id,
  },
  {
    title: "Task 2: Implement real-time updates",
    description:
      "The board should update automatically when other users make changes. Open two tabs to verify.",
    column: "todo",
    priority: "low",
    assignee_id: null,
    created_by: bob.id,
  },
];

const insert = db.prepare(
  'INSERT INTO tasks (title, description, "column", priority, position, assignee_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
);

tasks.forEach((task, i) => {
  insert.run(
    task.title,
    task.description,
    task.column,
    task.priority,
    (i + 1) * 1000,
    task.assignee_id,
    task.created_by,
  );
});

console.log("Seeded 3 users and 3 tasks.");
console.log("Login: alice@example.com / password123");
console.log("Login: bob@example.com / password123");
console.log("Login: charlie@example.com / password123");

db.close();

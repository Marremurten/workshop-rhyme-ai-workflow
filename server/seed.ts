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
    title: "Bygg ett AI-workflow för teamet",
    description:
      "Skapa ett workflow för hur ni ska arbeta med Claude Code för att implementera uppgift 1 och uppgift 2.",
    column: "todo",
    assignee_id: null,
    created_by: alice.id,
  },
  {
    title: "Uppgift 1: Lägg till task-prioritet (Low/Medium/High)",
    description:
      "Full-stack: ny kolumn i DB, uppdatera API, prioritet-väljare i UI, färgkodade kort.",
    column: "todo",
    assignee_id: null,
    created_by: alice.id,
  },
  {
    title: "Uppgift 2: Implementera real-time updates",
    description:
      "Boarden ska uppdateras automatiskt när andra användare gör ändringar. Öppna två flikar för att verifiera.",
    column: "todo",
    assignee_id: null,
    created_by: bob.id,
  },
];

const insert = db.prepare(
  'INSERT INTO tasks (title, description, "column", position, assignee_id, created_by) VALUES (?, ?, ?, ?, ?, ?)',
);

tasks.forEach((task, i) => {
  insert.run(
    task.title,
    task.description,
    task.column,
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

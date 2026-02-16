# SQLite (better-sqlite3) + Express.js Setup Research

## Summary

better-sqlite3 is well-suited for this kanban board app. It provides a synchronous API that simplifies Express.js integration -- no callback or promise wrangling needed. The recommended setup uses a module-level singleton with WAL mode, `CREATE TABLE IF NOT EXISTS` for schema management, and `db.transaction()` for atomic reorder operations. The main architectural decision is the position column strategy: REAL-valued midpoint insertion with periodic rebalance is the best tradeoff for a small kanban app.

## 1. Recommended Setup

### Install

```bash
npm install better-sqlite3
npm install -D @types/better-sqlite3
```

### Project Structure

```
db/
  schema.ts      # Table definitions + migration functions
  queries.ts     # All query functions (CRUD + reorder)
  index.ts       # Singleton getDb() export
data/
  kanban.db      # SQLite database file (gitignored)
```

### .gitignore entries

```gitignore
# SQLite database files
data/*.db
data/*.db-wal
data/*.db-shm
```

The `data/` directory should be created by the app on startup if it does not exist. Keep it separate from `db/` (which contains code). The `-wal` and `-shm` files are WAL-mode artifacts that SQLite manages automatically.

---

## 2. Connection and Initialization Pattern

### Singleton via Module Scope (Recommended)

TypeScript modules are inherently singletons -- when a module is imported, Node.js caches the result. This is simpler and more idiomatic than a class-based Singleton pattern.

```typescript
// db/index.ts
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { initSchema } from './schema';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const dataDir = path.join(__dirname, '..', 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    const dbPath = process.env.NODE_ENV === 'test'
      ? ':memory:'
      : path.join(dataDir, 'kanban.db');

    db = new Database(dbPath);

    // Performance pragmas
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');

    // Initialize schema
    initSchema(db);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
```

Key design decisions:
- **Lazy initialization**: The database is only created when first requested, not at module import time. This makes testing easier (you can set `NODE_ENV=test` before the first call).
- **`:memory:` for tests**: Each test suite gets a fresh in-memory database -- fast and isolated.
- **`busy_timeout = 5000`**: If another connection (e.g., a CLI tool) holds a write lock, wait up to 5 seconds instead of failing immediately.

### Using the singleton in Express routes

```typescript
// server/routes/tasks.ts
import { Router } from 'express';
import { getDb } from '../../db';

const router = Router();

router.get('/api/tasks', (req, res) => {
  const db = getDb();
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY column, position').all();
  res.json(tasks);
});
```

The synchronous API means no `await` is needed -- the query runs and returns immediately within the Express request handler.

---

## 3. Schema and Migration Approach

### Schema Definition with `db.exec()`

For a small app with 2 tables, use `CREATE TABLE IF NOT EXISTS` via `db.exec()`. This is idempotent and runs on every startup.

```typescript
// db/schema.ts
import Database from 'better-sqlite3';

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      column TEXT NOT NULL DEFAULT 'todo'
        CHECK (column IN ('todo', 'in_progress', 'done')),
      position REAL NOT NULL DEFAULT 0,
      assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_column_position
      ON tasks(column, position);
  `);
}
```

Design notes:
- **`TEXT` primary keys with UUIDs**: Avoids auto-increment issues and makes IDs safe to expose in URLs. Generate with `uuid` v4.
- **`REAL` for position**: Enables midpoint insertion without renumbering all rows (see Section 4).
- **`CHECK` constraint on column**: Database-level enforcement of valid column values.
- **Composite index on `(column, position)`**: Optimizes the most common query -- fetching tasks ordered within each column.
- **`ON DELETE SET NULL` for assignee_id**: If a user is deleted, tasks remain but lose their assignee.

### Migration Strategy

For a small app, a simple version-based migration approach works well:

```typescript
// db/schema.ts (continued)
export function runMigrations(db: Database.Database): void {
  // Create a migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const currentVersion = db.prepare(
    'SELECT MAX(version) as version FROM schema_version'
  ).get() as { version: number | null };

  const version = currentVersion?.version ?? 0;

  const migrations: Record<number, () => void> = {
    1: () => {
      // Example future migration: add a "priority" column
      // db.exec(`ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'medium'`);
    },
  };

  const applyMigration = db.transaction((v: number, fn: () => void) => {
    fn();
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(v);
  });

  for (const [v, fn] of Object.entries(migrations)) {
    const vNum = Number(v);
    if (vNum > version) {
      applyMigration(vNum, fn);
    }
  }
}
```

Each migration runs inside a transaction so it either fully applies or fully rolls back. For this small app, this lightweight approach avoids adding a migration library dependency.

---

## 4. Query Patterns (CRUD + Reordering Transactions)

### Basic CRUD

```typescript
// db/queries.ts
import { getDb } from './index';
import { v4 as uuid } from 'uuid';

// ---------- Users ----------

export function createUser(email: string, name: string, passwordHash: string) {
  const db = getDb();
  const id = uuid();
  db.prepare(`
    INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)
  `).run(id, email, name, passwordHash);
  return getUserById(id);
}

export function getUserByEmail(email: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function getUserById(id: string) {
  const db = getDb();
  return db.prepare(
    'SELECT id, email, name, created_at FROM users WHERE id = ?'
  ).get(id);
}

export function getAllUsers() {
  const db = getDb();
  return db.prepare('SELECT id, email, name FROM users').all();
}

// ---------- Tasks ----------

export function createTask(
  title: string,
  createdBy: string,
  description?: string,
  assigneeId?: string
) {
  const db = getDb();
  const id = uuid();

  // Place new task at the end of the "todo" column
  const lastPosition = db.prepare(
    `SELECT MAX(position) as maxPos FROM tasks WHERE column = 'todo'`
  ).get() as { maxPos: number | null };

  const position = (lastPosition?.maxPos ?? 0) + 1.0;

  db.prepare(`
    INSERT INTO tasks (id, title, description, column, position, assignee_id, created_by)
    VALUES (?, ?, ?, 'todo', ?, ?, ?)
  `).run(id, title, description ?? '', position, assigneeId ?? null, createdBy);

  return getTaskById(id);
}

export function getTaskById(id: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

export function getAllTasks() {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM tasks ORDER BY column, position'
  ).all();
}

export function updateTask(
  id: string,
  updates: { title?: string; description?: string; assignee_id?: string | null }
) {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.assignee_id !== undefined) {
    fields.push('assignee_id = ?');
    values.push(updates.assignee_id);
  }

  if (fields.length === 0) return getTaskById(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getTaskById(id);
}

export function deleteTask(id: string) {
  const db = getDb();
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return result.changes > 0;
}
```

### Reordering: The Position Strategy

**Approach: REAL-valued midpoint insertion with periodic rebalance.**

When a task is moved (drag-and-drop), calculate its new position as the midpoint between its new neighbors. This requires updating only ONE row instead of renumbering the entire column.

```
Before: Task A (pos 1.0), Task B (pos 2.0), Task C (pos 3.0)
Move C between A and B: C gets position (1.0 + 2.0) / 2 = 1.5
After:  Task A (pos 1.0), Task C (pos 1.5), Task B (pos 2.0)
```

When the gap between adjacent positions gets too small (below 0.001), rebalance the entire column to clean, evenly-spaced integers.

```typescript
// db/queries.ts (continued)

const MINIMUM_POSITION_GAP = 0.001;

export function moveTask(taskId: string, targetColumn: string, targetPosition: number) {
  const db = getDb();

  const moveTransaction = db.transaction(() => {
    // Get tasks in the target column, ordered by position
    const tasksInColumn = db.prepare(
      `SELECT id, position FROM tasks
       WHERE column = ? AND id != ?
       ORDER BY position`
    ).all(targetColumn, taskId) as { id: string; position: number }[];

    let newPosition: number;

    if (tasksInColumn.length === 0) {
      // Empty column -- place at 1.0
      newPosition = 1.0;
    } else if (targetPosition <= 0) {
      // Place at the top
      newPosition = tasksInColumn[0].position / 2;
    } else if (targetPosition >= tasksInColumn.length) {
      // Place at the bottom
      newPosition = tasksInColumn[tasksInColumn.length - 1].position + 1.0;
    } else {
      // Place between two tasks
      const before = tasksInColumn[targetPosition - 1].position;
      const after = tasksInColumn[targetPosition].position;
      newPosition = (before + after) / 2;
    }

    // Update the moved task
    db.prepare(`
      UPDATE tasks
      SET column = ?, position = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(targetColumn, newPosition, taskId);

    // Check if rebalance is needed
    const needsRebalance = checkNeedsRebalance(db, targetColumn);
    if (needsRebalance) {
      rebalanceColumn(db, targetColumn);
    }

    return getTaskById(taskId);
  });

  return moveTransaction();
}

function checkNeedsRebalance(db: Database.Database, column: string): boolean {
  const tasks = db.prepare(
    `SELECT position FROM tasks WHERE column = ? ORDER BY position`
  ).all(column) as { position: number }[];

  for (let i = 1; i < tasks.length; i++) {
    if (tasks[i].position - tasks[i - 1].position < MINIMUM_POSITION_GAP) {
      return true;
    }
  }
  return false;
}

function rebalanceColumn(db: Database.Database, column: string): void {
  const tasks = db.prepare(
    `SELECT id FROM tasks WHERE column = ? ORDER BY position`
  ).all(column) as { id: string }[];

  const updatePosition = db.prepare(
    `UPDATE tasks SET position = ? WHERE id = ?`
  );

  for (let i = 0; i < tasks.length; i++) {
    updatePosition.run(i + 1.0, tasks[i].id);
  }
}
```

**Why REAL midpoint over INTEGER renumbering?**
- Moving a card updates 1 row instead of N rows
- Rebalance is rare (only when precision degrades after many repeated inserts-between-the-same-pair)
- For a kanban board with dozens of tasks per column, you would need approximately 50 consecutive same-gap splits before triggering rebalance

**Why not fractional indexing (string-based)?**
- More complex to implement
- Overkill for a small app with limited concurrent users
- REAL midpoint is simpler and sufficient when you have a rebalance fallback

### Prepared Statement Caching

better-sqlite3 internally caches prepared statements, so calling `db.prepare(sql)` with the same SQL string is efficient. However, for frequently-called queries, you can store references:

```typescript
// For hot paths, store prepared statements at module scope
let _getAllTasks: Database.Statement | null = null;

export function getAllTasksCached() {
  const db = getDb();
  if (!_getAllTasks) {
    _getAllTasks = db.prepare('SELECT * FROM tasks ORDER BY column, position');
  }
  return _getAllTasks.all();
}
```

For a small app, the performance difference is negligible. Inline `db.prepare()` calls are fine and more readable.

---

## 5. Concurrency Considerations

### Why better-sqlite3 Works Well for This App

better-sqlite3 is synchronous and single-threaded. Since Node.js processes Express requests on a single event loop thread, database operations run one at a time. This means:

1. **No race conditions between request handlers**: Even if two users drag cards simultaneously, their transactions run sequentially. Each transaction sees a consistent state.
2. **WAL mode allows concurrent reads**: While one request is writing, other requests can still read. The writer does not block readers.
3. **Transactions are atomic**: The `db.transaction()` wrapper guarantees that a reorder operation either fully completes or fully rolls back.

### When This Breaks Down

- **Long-running queries block the event loop**: A query that scans millions of rows would freeze the entire Express server. For a kanban board with hundreds of tasks, this is a non-issue.
- **High write concurrency**: If many users are simultaneously reordering tasks, writes queue up. SQLite processes approximately 50,000 inserts/second in WAL mode -- far more than a small app needs.
- **Multiple Node.js processes**: If you run multiple Express instances (e.g., via PM2 cluster mode), each opens its own connection. WAL mode handles this, but you should set `busy_timeout` to avoid `SQLITE_BUSY` errors.

### Recommendation

For this single-board kanban app, the concurrency model is perfectly adequate. A single Express process with a single better-sqlite3 connection handles the expected load easily.

---

## 6. Graceful Shutdown

Register signal handlers to close the database cleanly:

```typescript
// server/index.ts
import { closeDb } from '../db';

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

function gracefulShutdown(signal: string) {
  console.log(`${signal} received. Shutting down...`);
  server.close(() => {
    closeDb();
    console.log('Database connection closed.');
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// process.on('exit') fires synchronously -- last chance to close
process.on('exit', () => {
  closeDb();
});
```

Closing the database in WAL mode triggers a final checkpoint, which cleans up the `-wal` and `-shm` files. If the process crashes without closing, SQLite recovers automatically on next open -- no data is lost.

---

## 7. Gotchas and Tips

### 1. Foreign Keys Are Off by Default

SQLite disables foreign key enforcement by default. You MUST run this on every new connection:

```typescript
db.pragma('foreign_keys = ON');
```

Without this, `REFERENCES users(id)` constraints are silently ignored.

### 2. `db.exec()` vs `db.prepare()`

- `db.exec(sql)`: Runs one or more statements. No return value. Use for DDL (CREATE TABLE, etc.) and multi-statement scripts.
- `db.prepare(sql)`: Creates a prepared statement for a single SQL statement. Use for all DML (SELECT, INSERT, UPDATE, DELETE).

Never use `db.exec()` with user-provided input -- it cannot use parameter binding and is vulnerable to SQL injection.

### 3. Transactions Must Be Synchronous

better-sqlite3 transactions cannot contain `await` calls. This is fine because all better-sqlite3 operations are synchronous. But if you need to do an async operation (e.g., call an external API) inside a transaction, you must restructure: do the async work first, then wrap only the database operations in a transaction.

```typescript
// WRONG -- will not work
const bad = db.transaction(async () => {
  const data = await fetchExternalApi(); // breaks transaction
  db.prepare('INSERT ...').run(data);
});

// CORRECT
const data = await fetchExternalApi();
const insert = db.transaction((data) => {
  db.prepare('INSERT ...').run(data);
});
insert(data);
```

### 4. `datetime('now')` vs JavaScript Dates

Use SQLite's `datetime('now')` in DEFAULT values for automatic timestamps. When inserting from JavaScript, use `new Date().toISOString()` for consistency. Both produce ISO 8601 strings.

### 5. NULL Handling in Parameterized Queries

Pass JavaScript `null` for SQL NULL. Passing `undefined` throws an error in better-sqlite3.

```typescript
// Good
stmt.run(null);

// Bad -- throws TypeError
stmt.run(undefined);
```

### 6. Testing Pattern

Use `:memory:` databases for tests. Each test file gets a fresh database:

```typescript
// tests/helpers.ts
import Database from 'better-sqlite3';
import { initSchema } from '../db/schema';

export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  return db;
}
```

For integration tests, you may need to inject the database into your query functions rather than relying on the singleton. One approach is to make query functions accept an optional `db` parameter that overrides the singleton.

### 7. Type Safety for Query Results

better-sqlite3's `.get()` and `.all()` return `unknown` by default. Use generics or type assertions:

```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  column: string;
  position: number;
  assignee_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
const tasks = db.prepare('SELECT * FROM tasks').all() as Task[];
```

### 8. Database File Location

Store the database file outside the source tree in a `data/` directory:
- Prevents accidental deletion during `npm run build` or other cleanup scripts
- Makes it clear that `data/` is runtime state, not source code
- The `db/` directory contains only TypeScript source files

---

## Recommendation

Use the patterns described above. Specifically:

1. **Module-scope singleton** via `getDb()` in `db/index.ts` -- simplest pattern, leverages Node.js module caching
2. **WAL mode + `foreign_keys = ON` + `busy_timeout = 5000`** pragmas on every connection
3. **`CREATE TABLE IF NOT EXISTS`** for initial schema, with a simple version-tracked migration table for future changes
4. **REAL-valued position** column with midpoint insertion and rebalance -- best balance of simplicity and performance for drag-and-drop reordering
5. **`db.transaction()`** for all multi-statement operations (especially the move/reorder endpoint)
6. **Graceful shutdown** with SIGINT/SIGTERM handlers that close the database

## Trade-offs

| Decision | Benefit | Cost |
|----------|---------|------|
| REAL position with rebalance | Single-row update on move, simple math | Occasional rebalance of entire column; position values are not "clean" integers |
| Module singleton (not class) | Simple, idiomatic TypeScript | Harder to test without dependency injection; global state |
| `:memory:` for tests | Fast, isolated | Does not test file I/O edge cases (disk full, permissions) |
| `CREATE TABLE IF NOT EXISTS` | Zero-config startup | Cannot handle column renames or drops without migration functions |
| Synchronous API | No async complexity, no race conditions | Blocks event loop during queries (acceptable for small datasets) |

## Open Questions

1. **UUID format**: The PRD specifies `INTEGER` primary keys, but UUIDs (TEXT) are more common in modern apps and safer for client-side generation. Should we follow the PRD literally or use UUIDs? (Recommendation: use UUIDs for better security and flexibility.)
2. **Position column type in PRD**: The PRD says `INTEGER` for position, but `REAL` is needed for midpoint insertion. This is a minor deviation from the PRD schema.
3. **Prepared statement caching strategy**: For this small app, inline `db.prepare()` calls are fine. If performance profiling later shows this is a bottleneck, module-level statement caching can be added without architectural changes.

---

## Sources

- [better-sqlite3 GitHub Repository](https://github.com/WiseLibs/better-sqlite3)
- [better-sqlite3 API Documentation](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)
- [better-sqlite3 Performance Tips](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md)
- [SQLite WAL Mode Documentation](https://sqlite.org/wal.html)
- [Kanban Board Position Indexing (Nick McCleery)](https://nickmccleery.com/posts/08-kanban-indexing/)
- [Fractional Indexing Explained (Steve Ruiz)](https://www.steveruiz.me/posts/reordering-fractional-indices)
- [Snyk better-sqlite3 Code Examples](https://snyk.io/advisor/npm-package/better-sqlite3/example)
- [SQLite Pragma Documentation](https://www.sqlite.org/pragma.html)
- [better-sqlite3 WAL Cleanup Issue #376](https://github.com/WiseLibs/better-sqlite3/issues/376)
- [How SQLite Scales Read Concurrency (Fly.io)](https://fly.io/blog/sqlite-internals-wal/)

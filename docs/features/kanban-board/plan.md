# Technical Plan: Kanban Board Task Manager

## Decisions Log

| Decision | Chosen | Alternative | Reason |
|----------|--------|-------------|--------|
| Primary keys | INTEGER AUTOINCREMENT | UUID (TEXT) | User decision — simpler, matches PRD |
| Position column type | REAL | INTEGER | Research recommendation — enables midpoint insertion (1 write per move) |
| JWT storage | httpOnly cookie (SameSite=lax) | localStorage | Research recommendation — prevents XSS token theft |
| Token revocation | Client-side only (clear cookie) | Server-side revoked_tokens table | User decision — simpler, matches PRD |
| Routing | No react-router (conditional rendering) | React Router | Research recommendation — sufficient for 3 views |
| Task creation UX | Inline Trello-style (title only) | Modal with all fields | Research recommendation — lower friction, proven UX |
| Drag collision detection | closestCorners | pointerWithin | Research recommendation — best for stacked containers |
| Drag activation | PointerSensor distance: 8 | No threshold | Research recommendation — prevents accidental drags on click |
| Failed drag recovery | Refetch full board | Local rollback | Research recommendation — guarantees consistency |
| Toast notifications | Lightweight custom component | react-toastify | PRD constraint — minimal dependencies |
| CORS | None (Vite proxy in dev, same-origin in prod) | cors package | Research finding — unnecessary with proxy setup |

## DB Changes

### Schema (created via `CREATE TABLE IF NOT EXISTS` on startup)

```sql
-- Pragmas (set on every connection)
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    UNIQUE NOT NULL,
  name          TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT    NOT NULL,
  description   TEXT,
  column        TEXT    NOT NULL DEFAULT 'todo'
                        CHECK(column IN ('todo', 'in_progress', 'done')),
  position      REAL    NOT NULL,
  assignee_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by    INTEGER NOT NULL REFERENCES users(id),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_column_position
  ON tasks(column, position);
```

Database file: `data/kanban.db` (gitignored: `data/*.db`, `data/*.db-wal`, `data/*.db-shm`).
Tests use `:memory:` databases.

No migration system for MVP — `CREATE TABLE IF NOT EXISTS` on startup is sufficient.

## API Contracts

All endpoints return JSON. Error shape: `{ error: string }`.
Auth cookie: `token` — httpOnly, SameSite=lax, Secure in production, path=/, maxAge=7 days.

### POST /api/auth/register
```
Request:  { email: string, name: string, password: string }
Success (201): { user: { id: number, email: string, name: string } } + Set-Cookie
Error (400):   { error: "Email, name, and password are required" }
Error (409):   { error: "Email already registered" }
```

### POST /api/auth/login
```
Request:  { email: string, password: string }
Success (200): { user: { id: number, email: string, name: string } } + Set-Cookie
Error (401):   { error: "Invalid email or password" }
```

### GET /api/auth/me — requires auth
```
Success (200): { user: { id: number, email: string, name: string } }
Error (401):   { error: "Unauthorized" }
```

### POST /api/auth/logout
```
Success (200): { message: "Logged out" } + Clear-Cookie
```

### GET /api/users — requires auth
```
Success (200): { users: [{ id: number, email: string, name: string }] }
```

### GET /api/tasks — requires auth
```
Success (200): { tasks: [{ id, title, description, column, position, assignee_id, created_by, created_at, updated_at }] }
```
Tasks returned sorted by column, then position ascending.

### POST /api/tasks — requires auth
```
Request:  { title: string, description?: string, column?: string, assignee_id?: number }
Success (201): { task: { id, title, description, column, position, assignee_id, created_by, created_at, updated_at } }
Error (400):   { error: "Title is required" }
```
Default column: `"todo"`. Position: appended to end of column (last task's position + 1000, or 1000 if column is empty).

### PUT /api/tasks/:id — requires auth
```
Request:  { title?: string, description?: string, assignee_id?: number | null, column?: string }
Success (200): { task: { ... } }
Error (404):   { error: "Task not found" }
Error (400):   { error: "..." }
```

### DELETE /api/tasks/:id — requires auth
```
Success (200): { message: "Task deleted" }
Error (404):   { error: "Task not found" }
```

### PATCH /api/tasks/:id/move — requires auth
```
Request:  { column: string, index: number }
Success (200): { task: { ... } }
Error (404):   { error: "Task not found" }
Error (400):   { error: "..." }
```
`index` is the desired 0-based position in the target column. Server computes the REAL midpoint:
- Empty column → position = 1000
- Index 0 (start) → position = firstTask.position / 2
- Index = length (end) → position = lastTask.position + 1000
- Middle → position = (tasks[index-1].position + tasks[index].position) / 2
- If gap < 0.001 → rebalance entire column (renumber to clean integers, spacing 1000)

The moved task is excluded from the column's task list before calculating its new position.

## Project Structure

```
/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── vitest.config.ts
├── .gitignore
├── data/                          # gitignored
├── server/
│   ├── index.ts                   # entry point (listen + shutdown)
│   ├── app.ts                     # express app + route registration
│   ├── db/
│   │   └── index.ts               # connection + schema init
│   ├── middleware/
│   │   ├── auth.ts                # requireAuth JWT middleware
│   │   └── error.ts               # error handler
│   ├── routes/
│   │   ├── auth.ts                # register, login, me, logout
│   │   ├── users.ts               # list users
│   │   └── tasks.ts               # CRUD + move
│   └── __tests__/
│       ├── db.test.ts
│       ├── app.test.ts
│       ├── auth.routes.test.ts
│       ├── tasks.routes.test.ts
│       └── helpers.ts             # test utilities (create test app, seed data)
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── api/
│   │   └── client.ts              # fetch wrapper with credentials: 'include'
│   ├── hooks/
│   │   ├── useAuth.tsx            # AuthProvider context + hook
│   │   └── useTasks.ts            # task state + CRUD operations
│   ├── components/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   ├── Board.tsx
│   │   ├── Column.tsx
│   │   ├── TaskCard.tsx
│   │   ├── CreateTaskForm.tsx
│   │   ├── EditTaskModal.tsx
│   │   ├── Toast.tsx
│   │   └── BoardHeader.tsx
│   └── __tests__/
│       ├── api.test.ts
│       ├── useAuth.test.tsx
│       ├── LoginForm.test.tsx
│       ├── Board.test.tsx
│       ├── Column.test.tsx
│       ├── TaskCard.test.tsx
│       ├── EditTaskModal.test.tsx
│       ├── Toast.test.tsx
│       └── setup.ts               # test setup (testing-library matchers)
```

### Dev scripts
- `npm run dev` — concurrently starts Vite dev server + Express server (via tsx)
- `npm run build` — builds frontend with Vite
- `npm run test` — runs vitest
- `npm run server` — starts Express only (via tsx)

### Key dependencies
**Runtime:** express, better-sqlite3, bcrypt, jsonwebtoken, cookie-parser, react, react-dom, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
**Dev:** typescript, vite, @vitejs/plugin-react, vitest, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, supertest, tailwindcss, postcss, autoprefixer, tsx, concurrently, jsdom, @types/* (express, better-sqlite3, bcrypt, jsonwebtoken, cookie-parser, supertest)

---

## Implementation Tasks (TDD Pairs)

#### Task 1-test: Database module tests
- Type: test
- Files: server/__tests__/db.test.ts
- Dependencies: none
- Description: Write tests for the database module using an in-memory SQLite database.
  Test that: (1) `getDb()` returns a database connection, (2) users table exists with
  columns id (integer PK), email (text unique not null), name (text not null),
  password_hash (text not null), created_at (text not null), (3) tasks table exists
  with columns id (integer PK), title (text not null), description (text nullable),
  column (text not null, check constraint for todo/in_progress/done), position (real
  not null), assignee_id (integer nullable FK to users), created_by (integer not null
  FK to users), created_at (text not null), updated_at (text not null), (4) foreign
  key constraint works (inserting task with nonexistent created_by fails), (5) unique
  constraint on users.email works, (6) check constraint on tasks.column rejects
  invalid values, (7) index idx_tasks_column_position exists.

#### Task 1-impl: Project scaffold + database module
- Type: impl
- Files: package.json, tsconfig.json, vitest.config.ts, server/db/index.ts
- Dependencies: Task 1-test
- Description: Initialize the project with npm, install all dependencies (runtime and
  dev), create TypeScript and Vitest configs. Implement the database module at
  server/db/index.ts that exports `getDb(dbPath?)` — returns a better-sqlite3
  Database instance with WAL mode, foreign keys ON, synchronous NORMAL, busy_timeout
  5000. On first call, runs CREATE TABLE IF NOT EXISTS for users and tasks tables per
  the schema. Default dbPath is `data/kanban.db`; pass `:memory:` for tests. Add
  `data/` to .gitignore. Read the tests at server/__tests__/db.test.ts — make them pass.

#### Task 2-test: Express app + auth middleware tests
- Type: test
- Files: server/__tests__/app.test.ts, server/__tests__/helpers.ts
- Dependencies: Task 1-impl
- Description: Write tests for the Express app and auth middleware. Create a test
  helpers file that exports `createTestApp()` — initializes app with in-memory db.
  Test the app: (1) unknown routes return 404 JSON `{ error: "Not found" }`,
  (2) malformed JSON body returns 400. Test the auth middleware: (1) request with
  valid JWT cookie proceeds (req.userId is set), (2) request with no cookie returns
  401 `{ error: "Unauthorized" }`, (3) request with expired/invalid JWT returns 401,
  (4) request with malformed token returns 401. The JWT contains `{ userId: number }`
  and is signed with a secret from env var `JWT_SECRET` (default: "dev-secret").

#### Task 2-impl: Express app + auth middleware + error handler
- Type: impl
- Files: server/app.ts, server/index.ts, server/middleware/auth.ts, server/middleware/error.ts
- Dependencies: Task 2-test
- Description: Create the Express application. server/app.ts exports a function
  `createApp(db)` that returns an Express app with cookie-parser, express.json(),
  and the error handler. server/middleware/auth.ts exports `requireAuth` middleware
  that reads the `token` cookie, verifies it with jsonwebtoken, and sets `req.userId`.
  server/middleware/error.ts exports an error handler that returns `{ error: message }`
  with appropriate status codes. server/index.ts is the entry point — initializes db,
  creates app, listens on PORT env var (default 3001), registers SIGINT/SIGTERM
  handlers to close db. Read the tests at server/__tests__/app.test.ts — make them pass.

#### Task 3-test: Auth routes + users route tests
- Type: test
- Files: server/__tests__/auth.routes.test.ts
- Dependencies: Task 2-impl
- Description: Write tests for auth and users API routes using supertest. Test
  register: (1) valid registration returns 201 + user object + sets cookie,
  (2) duplicate email returns 409, (3) missing fields returns 400, (4) password is
  hashed (not stored in plain text). Test login: (1) valid credentials return 200 +
  user + cookie, (2) wrong password returns 401 with generic message, (3) nonexistent
  email returns 401 with same generic message. Test me: (1) with valid cookie returns
  200 + user, (2) without cookie returns 401. Test logout: (1) clears the cookie.
  Test GET /api/users: (1) returns all registered users (id, email, name — no
  password_hash), (2) requires auth (401 without cookie). Use the test helpers from
  server/__tests__/helpers.ts to create a test app with in-memory db.

#### Task 3-impl: Auth routes + users route
- Type: impl
- Files: server/routes/auth.ts, server/routes/users.ts, server/app.ts
- Dependencies: Task 3-test
- Description: Implement auth routes (register, login, me, logout) and users route
  (list all users). Register in app.ts. Register: validate input, check duplicate
  email, hash password with bcrypt (10 rounds, async), insert user, sign JWT with
  { userId } payload and 7-day expiry, set httpOnly cookie. Login: find user by email,
  compare password with bcrypt, sign JWT, set cookie. Me: read userId from req
  (set by auth middleware), query user, return without password_hash. Logout: clear
  cookie with same options used to set it. Users: query all users, return without
  password_hash. Cookie options: httpOnly, sameSite lax, secure if NODE_ENV=production,
  path /, maxAge 7 days. Read tests at server/__tests__/auth.routes.test.ts — make them pass.

#### Task 4-test: Tasks API tests (CRUD + move)
- Type: test
- Files: server/__tests__/tasks.routes.test.ts
- Dependencies: Task 2-impl
- Description: Write tests for tasks API using supertest. Setup: register a user and
  use their auth cookie for all requests. Test GET /api/tasks: (1) returns empty array
  initially, (2) returns tasks sorted by column then position, (3) requires auth.
  Test POST /api/tasks: (1) creates task with title, returns 201, (2) defaults
  column to "todo", (3) position is auto-calculated (end of column), (4) missing title
  returns 400, (5) sets created_by to authenticated user. Test PUT /api/tasks/:id:
  (1) updates title, (2) updates description, (3) sets assignee_id, (4) clears
  assignee_id with null, (5) nonexistent id returns 404, (6) updates updated_at
  timestamp. Test DELETE /api/tasks/:id: (1) deletes task returns 200, (2) nonexistent
  id returns 404. Test PATCH /api/tasks/:id/move: (1) move to different column
  updates column and position, (2) reorder within same column, (3) move to empty
  column sets position 1000, (4) move to start of column, (5) move to end of column,
  (6) move between two tasks gets midpoint position, (7) nonexistent id returns 404.

#### Task 4-impl: Tasks API (CRUD + move)
- Type: impl
- Files: server/routes/tasks.ts, server/app.ts
- Dependencies: Task 4-test
- Description: Implement tasks CRUD routes and the move endpoint. Register in app.ts.
  GET: select all tasks ordered by column, position. POST: validate title required,
  calculate position as last task's position + 1000 (or 1000 if empty column),
  set created_by from req.userId, insert and return. PUT: validate task exists,
  update only provided fields, set updated_at to now. DELETE: validate task exists,
  delete. PATCH move: validate task exists, read index from body, get all other tasks
  in target column ordered by position, calculate new REAL position using midpoint
  strategy (empty=1000, start=first/2, end=last+1000, middle=average of neighbors),
  update task's column and position, if any gap < 0.001 rebalance entire column
  (renumber positions as 1000, 2000, 3000...). All routes use requireAuth middleware.
  Wrap async handlers in try/catch. Read tests at server/__tests__/tasks.routes.test.ts.

#### Task 5-test: API client tests
- Type: test
- Files: src/__tests__/api.test.ts
- Dependencies: none
- Description: Write tests for the frontend API client module. Mock global fetch.
  Test each function: (1) login(email, password) — POSTs to /api/auth/login with
  credentials:'include', returns user on success, throws on error.
  (2) register(email, name, password) — POSTs to /api/auth/register.
  (3) fetchMe() — GETs /api/auth/me with credentials:'include'.
  (4) logout() — POSTs to /api/auth/logout.
  (5) fetchUsers() — GETs /api/users.
  (6) fetchTasks() — GETs /api/tasks.
  (7) createTask(data) — POSTs to /api/tasks.
  (8) updateTask(id, data) — PUTs to /api/tasks/:id.
  (9) deleteTask(id) — DELETEs /api/tasks/:id.
  (10) moveTask(id, column, index) — PATCHes /api/tasks/:id/move.
  Verify all requests include credentials:'include' and Content-Type application/json.
  Verify error responses throw with the error message from the server.

#### Task 5-impl: Frontend scaffold + API client
- Type: impl
- Files: vite.config.ts, tailwind.config.js, postcss.config.js, index.html, src/api/client.ts
- Dependencies: Task 5-test
- Description: Set up the Vite + React + Tailwind frontend. vite.config.ts: React
  plugin, proxy /api to http://localhost:3001. tailwind.config.js: content paths for
  src/**/*.tsx. postcss.config.js: standard Tailwind PostCSS config. index.html:
  minimal HTML with #root div. src/api/client.ts: export async functions for all
  API calls. Each function uses fetch with credentials:'include'. POST/PUT/PATCH
  include Content-Type application/json header and JSON.stringify body. On non-ok
  response, parse JSON and throw new Error(data.error). Read tests at
  src/__tests__/api.test.ts — make them pass.

#### Task 6-test: Auth context + login/register UI tests
- Type: test
- Files: src/__tests__/useAuth.test.tsx, src/__tests__/LoginForm.test.tsx, src/__tests__/setup.ts
- Dependencies: Task 5-impl
- Description: Create the test setup file (src/__tests__/setup.ts) with
  @testing-library/jest-dom matchers. Write tests for auth context and login/register
  components. Mock src/api/client. Test AuthProvider: (1) calls fetchMe on mount and
  sets user if authenticated, (2) shows loading state while checking auth, (3) sets
  user to null if fetchMe fails (not authenticated), (4) login function calls
  api.login and updates user state, (5) logout function calls api.logout and clears
  user state, (6) register function calls api.register and updates user state. Test
  LoginForm: (1) renders email and password inputs + submit button, (2) calls onLogin
  with email/password on submit, (3) shows error message on login failure, (4) has
  link/button to switch to register mode. Test RegisterForm (in LoginForm.test.tsx):
  (1) renders email, name, password inputs, (2) calls onRegister with data on submit,
  (3) shows error on failure. Use @testing-library/react and userEvent.

#### Task 6-impl: Auth context + login/register UI
- Type: impl
- Files: src/hooks/useAuth.tsx, src/components/LoginForm.tsx, src/components/RegisterForm.tsx, src/App.tsx, src/main.tsx
- Dependencies: Task 6-test
- Description: Implement auth context and login/register UI. src/main.tsx: React entry
  point that renders App into #root, imports src/index.css. Also create src/index.css
  with Tailwind directives (@tailwind base/components/utilities). useAuth.tsx: create
  AuthContext with user state, login/logout/register functions, and loading flag.
  AuthProvider calls fetchMe() on mount to check existing session. Exports useAuth()
  hook. LoginForm.tsx: controlled form with email + password fields, submit handler
  calls the login function from context, shows inline error on failure, link to
  switch to register. RegisterForm.tsx: controlled form with email + name + password.
  App.tsx: wraps everything in AuthProvider. Shows loading spinner during auth check.
  If no user, shows LoginForm (with toggle to RegisterForm). If user, shows Board
  (placeholder div for now). Style with Tailwind — centered card layout for auth forms.
  Read tests at src/__tests__/useAuth.test.tsx and src/__tests__/LoginForm.test.tsx.

#### Task 7-test: Board + columns + drag-and-drop tests
- Type: test
- Files: src/__tests__/Board.test.tsx, src/__tests__/Column.test.tsx
- Dependencies: Task 6-impl
- Description: Write tests for Board and Column components. Mock src/api/client and
  useTasks hook. Test Board: (1) renders three columns with titles "To Do",
  "In Progress", "Done", (2) distributes tasks to correct columns based on task.column,
  (3) calls moveTask when a card is dropped in a different column, (4) shows loading
  skeleton while tasks are loading. Test Column: (1) renders column title and task
  count badge, (2) renders TaskCard for each task, (3) shows empty state with
  "No tasks yet" when column has no tasks, (4) renders CreateTaskForm at the bottom,
  (5) is a valid drop target (has droppable wrapper). Use @testing-library/react.
  Note: drag-and-drop interactions are difficult to test with testing-library, so
  focus on rendering and state, not actual DnD events.

#### Task 7-impl: Board + columns + drag-and-drop + task state
- Type: impl
- Files: src/components/Board.tsx, src/components/Column.tsx, src/hooks/useTasks.ts
- Dependencies: Task 7-test
- Description: Implement the board with drag-and-drop. useTasks.ts: custom hook that
  fetches tasks on mount, maintains state as { tasks: Record<number, Task>,
  columns: Record<ColumnId, number[]> }. Exposes fetchTasks, addTask, updateTask,
  removeTask, moveTask functions. moveTask does optimistic update then calls
  api.moveTask; on failure, refetches all tasks and shows error (via callback).
  Board.tsx: DndContext wrapping three Column components. Uses closestCorners collision
  detection. PointerSensor with distance:8 + KeyboardSensor. DragOverlay always
  mounted, renders ghost card during drag. onDragEnd computes target column and index,
  calls moveTask. Column.tsx: SortableContext (vertically) for its task IDs. Renders
  column header (title + count), task cards via map, empty state if no tasks,
  CreateTaskForm at bottom. useDroppable wrapper on column body for empty-column drops.
  Style with Tailwind: horizontal flex for board, w-80 columns, bg-gray-50 board bg.
  Read tests at src/__tests__/Board.test.tsx and src/__tests__/Column.test.tsx.

#### Task 8-test: Task cards + create form + edit modal tests
- Type: test
- Files: src/__tests__/TaskCard.test.tsx, src/__tests__/CreateTaskForm.test.tsx, src/__tests__/EditTaskModal.test.tsx
- Dependencies: Task 7-impl
- Description: Write tests for TaskCard, CreateTaskForm, and EditTaskModal. Test
  TaskCard: (1) renders task title, (2) shows truncated description (1 line), (3)
  shows assignee name/initials if assigned, (4) opens edit modal on click, (5) is
  draggable (has useSortable attributes). Test CreateTaskForm: (1) shows "+ Add a
  card" button initially, (2) clicking button shows title input, (3) Enter submits
  and calls createTask with title and column, (4) Escape cancels and hides input,
  (5) input clears after submit but form stays open (Trello-style). Test
  EditTaskModal: (1) renders with task data pre-filled, (2) can edit title, (3)
  can edit description, (4) assignee dropdown shows all users, (5) can change column
  from dropdown, (6) save calls updateTask with changed fields, (7) delete button
  shows confirmation, confirming calls deleteTask and closes modal, (8) clicking
  overlay/X closes modal without saving.

#### Task 8-impl: Task cards + create form + edit modal
- Type: impl
- Files: src/components/TaskCard.tsx, src/components/CreateTaskForm.tsx, src/components/EditTaskModal.tsx
- Dependencies: Task 8-test
- Description: Implement task card, inline create form, and edit modal. TaskCard.tsx:
  uses useSortable hook. Renders white card with shadow-sm, rounded-lg, p-3. Shows
  title (font-bold, 2-line clamp), 1-line description preview (text-gray-500),
  assignee initials circle (bottom-right). Hover: shadow-md. Click opens edit modal.
  Memoize with React.memo. CreateTaskForm.tsx: initially shows "+ Add a card" text
  button. On click, replaces with auto-focused text input. Enter submits (calls
  addTask from useTasks), clears input, keeps form open. Escape reverts to button.
  EditTaskModal.tsx: overlay + centered card. Title as editable input, description as
  textarea, assignee as select dropdown (populated from useUsers or passed as prop),
  column as select dropdown. Save button calls updateTask. Delete button in footer
  with "Are you sure?" confirmation. Close on overlay click or X button. Style all
  with Tailwind per the UX research specs. Read tests at src/__tests__/TaskCard.test.tsx
  and src/__tests__/EditTaskModal.test.tsx.

#### Task 9-test: UX polish tests (toasts, loading, header)
- Type: test
- Files: src/__tests__/Toast.test.tsx, src/__tests__/BoardHeader.test.tsx
- Dependencies: Task 8-impl
- Description: Write tests for Toast and BoardHeader components. Test Toast:
  (1) renders message text, (2) success toast auto-dismisses after 3 seconds,
  (3) error toast persists (does not auto-dismiss), (4) clicking X dismisses toast,
  (5) multiple toasts stack vertically. Test BoardHeader: (1) renders app title
  (e.g., "Kanban Board"), (2) shows current user name, (3) refresh button calls
  fetchTasks when clicked, (4) logout button calls logout from auth context.

#### Task 9-impl: UX polish (toasts, loading, empty states, header)
- Type: impl
- Files: src/components/Toast.tsx, src/components/BoardHeader.tsx, src/components/Board.tsx, src/components/Column.tsx
- Dependencies: Task 9-test
- Description: Implement Toast notification system and BoardHeader, and integrate
  loading/empty states into existing components. Toast.tsx: fixed bottom-right
  container. Each toast has message, type (success/error), and dismiss button.
  Success toasts auto-dismiss after 3s. Error toasts persist. Export a useToast hook
  or context that exposes showToast(message, type). BoardHeader.tsx: flex row with
  app title, spacer, current user display, refresh button (calls fetchTasks),
  and logout button. Update Board.tsx: add BoardHeader at top, show skeleton loading
  (3 columns with animate-pulse placeholder cards) while tasks are loading, wire up
  toast notifications for task CRUD operations. Update Column.tsx: ensure empty state
  renders dashed border container with "No tasks yet" text and the drop target
  remains active. Style with Tailwind. Read tests at src/__tests__/Toast.test.tsx
  and src/__tests__/BoardHeader.test.tsx.

---

## Execution Waves

```
Wave 1:  Task 1-test, Task 5-test               (2 parallel — no dependencies)
Wave 2:  Task 1-impl, Task 5-impl               (2 parallel — each depends on its test)
Wave 3:  Task 2-test, Task 6-test               (2 parallel — 2-test needs 1-impl, 6-test needs 5-impl)
Wave 4:  Task 2-impl, Task 6-impl               (2 parallel — each depends on its test)
Wave 5:  Task 3-test, Task 4-test, Task 7-test  (3 parallel — 3&4 need 2-impl, 7 needs 6-impl)
Wave 6:  Task 3-impl, Task 4-impl, Task 7-impl  (3 parallel — each depends on its test)
Wave 7:  Task 8-test                             (1 — needs 7-impl)
Wave 8:  Task 8-impl                             (1 — needs 8-test)
Wave 9:  Task 9-test                             (1 — needs 8-impl)
Wave 10: Task 9-impl                             (1 — needs 9-test)
```

Backend stream (Waves 1-6): Tasks 1 → 2 → 3, 4
Frontend stream (Waves 1-6): Tasks 5 → 6 → 7
Converged stream (Waves 7-10): Tasks 8 → 9

Max parallelism: 3 (Wave 5, Wave 6)
Total tasks: 18 (9 test + 9 impl)

---

## Context Budget Check

- [x] No task touches more than 5 files
- [x] Each task description is under 20 lines
- [x] Each task can be understood without reading the full plan
- [x] Dependencies are explicit — no implicit ordering
- [x] Every impl task depends on its corresponding test task
- [x] No test task depends on its own impl task

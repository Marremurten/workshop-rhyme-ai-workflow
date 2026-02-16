# Plan Verification: Kanban Board Task Manager

## Result: PASS

## Coverage (PRD -> Plan)

| PRD Criterion | Plan Task(s) | Status |
|---|---|---|
| Users can register, log in, and access the board | Task 3 (auth routes: register, login, me, logout), Task 6 (auth context + login/register UI) | COVERED |
| Unauthenticated requests rejected with 401 | Task 2 (auth middleware returns 401), Task 3 (tests verify 401 without cookie) | COVERED |
| Passwords hashed with bcrypt | Task 3-test (verifies password is hashed, not plain text), Task 3-impl (hash with bcrypt 10 rounds) | COVERED |
| Logout (client-side token removal) | Task 3-impl (clears cookie), Task 6-impl (logout function in auth context) | COVERED |
| Protected API routes (JWT middleware) | Task 2 (requireAuth middleware), Tasks 3-4 (all routes use requireAuth) | COVERED |
| Single shared board visible to all authenticated users | Task 7 (Board component renders for authenticated users), Task 4 (GET /api/tasks returns all tasks) | COVERED |
| Three fixed columns: To Do, In Progress, Done | Task 7-test (verifies three columns with titles), DB schema CHECK constraint on column values | COVERED |
| Drag-and-drop cards between columns using @dnd-kit | Task 7-impl (DndContext, closestCorners, PointerSensor, DragOverlay), Task 4-impl (PATCH move endpoint) | COVERED |
| Card ordering within columns preserved | Task 4 (position REAL + midpoint strategy + rebalance), Task 7-impl (SortableContext per column) | COVERED |
| Position persists after refresh | Task 4-impl (server persists position), Task 7-impl (useTasks fetches on mount) | COVERED |
| Create a new task (title required, description and assignee optional) | Task 4 (POST /api/tasks), Task 8 (CreateTaskForm inline, EditTaskModal for full fields) | COVERED |
| Edit task title, description, and assignee | Task 4 (PUT /api/tasks/:id), Task 8 (EditTaskModal with editable fields) | COVERED |
| Delete a task | Task 4 (DELETE /api/tasks/:id), Task 8 (EditTaskModal delete button with confirmation) | COVERED |
| Assignee dropdown of registered users | Task 3-impl (GET /api/users returns all users), Task 8-test/impl (assignee dropdown shows all users) | COVERED |
| Cards display title, assignee avatar/name, truncated description | Task 8 (TaskCard renders title, 1-line description preview, assignee initials circle) | COVERED |
| Clean, modern UI with Tailwind CSS | Task 5-impl (Tailwind setup), all UI tasks use Tailwind styling | COVERED |
| Responsive layout (desktop; tablet acceptable) | Task 7-impl (horizontal flex board layout, w-80 columns) -- no mobile breakpoints, consistent with PRD | COVERED |
| Smooth drag-and-drop animations | Task 7-impl (DragOverlay ghost card, PointerSensor distance:8) | COVERED |
| Loading states and error feedback (toasts or inline) | Task 9 (Toast component, loading skeletons in Board), Task 6 (loading spinner during auth check), Task 6-impl (inline error on login failure) | COVERED |
| Empty states for columns with no tasks | Task 7-test (Column shows "No tasks yet"), Task 9-impl (dashed border empty state) | COVERED |
| Manual refresh (reload page or click refresh button) | Task 9 (BoardHeader with refresh button calling fetchTasks) | COVERED |
| No WebSockets or polling | No WebSocket/polling code anywhere in plan; decisions log confirms "No real-time" | COVERED |

## Scope Check (Plan -> PRD)

| Plan Task | PRD Requirement | Status |
|---|---|---|
| Task 1-test: Database module tests | Supporting task for Auth (Section 1) and Tasks (Section 3) -- database underpins both | OK (supporting) |
| Task 1-impl: Project scaffold + database module | Supporting task for entire application -- PRD specifies SQLite via better-sqlite3 | OK (supporting) |
| Task 2-test: Express app + auth middleware tests | Auth: Protected API routes (JWT middleware) | OK |
| Task 2-impl: Express app + auth middleware + error handler | Auth: Protected API routes; Constraints: proper HTTP status codes + JSON errors | OK |
| Task 3-test: Auth routes + users route tests | Auth: register, login, me, logout; Tasks: assignee dropdown (GET /api/users) | OK |
| Task 3-impl: Auth routes + users route | Auth: register, login, me, logout; Tasks: assignee dropdown | OK |
| Task 4-test: Tasks API tests (CRUD + move) | Tasks: CRUD; Board: drag-and-drop persistence | OK |
| Task 4-impl: Tasks API (CRUD + move) | Tasks: CRUD; Board: drag-and-drop persistence | OK |
| Task 5-test: API client tests | Supporting task for frontend -- bridges frontend to backend API | OK (supporting) |
| Task 5-impl: Frontend scaffold + API client | Supporting task for UX & Design, Auth UI; PRD specifies React (Vite) + Tailwind | OK (supporting) |
| Task 6-test: Auth context + login/register UI tests | Auth: register, login; UX: loading states | OK |
| Task 6-impl: Auth context + login/register UI | Auth: register, login, logout; UX: loading states | OK |
| Task 7-test: Board + columns + drag-and-drop tests | Board: three columns, card distribution, drag-and-drop, empty states | OK |
| Task 7-impl: Board + columns + drag-and-drop + task state | Board: three columns, drag-and-drop, card ordering; UX: optimistic updates | OK |
| Task 8-test: Task cards + create form + edit modal tests | Tasks: create, edit, delete; Board: card display | OK |
| Task 8-impl: Task cards + create form + edit modal | Tasks: create, edit, delete; Board: card display with title/description/assignee | OK |
| Task 9-test: UX polish tests (toasts, loading, header) | UX: error feedback (toasts), loading states; Data Refresh: refresh button | OK |
| Task 9-impl: UX polish (toasts, loading, empty states, header) | UX: toasts, loading, empty states; Data Refresh: refresh button | OK |

## Out-of-Scope Check

| Out-of-Scope Item | Found in Plan? | Status |
|---|---|---|
| Real-time/live updates (WebSockets, SSE, polling) | No. Plan uses manual refresh only. | OK |
| Multiple boards | No. Single shared board only. | OK |
| Custom columns | No. Three fixed columns with CHECK constraint. | OK |
| User roles/permissions | No. All users are equal; no role field in schema. | OK |
| Due dates, labels, priorities | No. Task schema has only title, description, assignee. | OK |
| File attachments | No. Not mentioned in plan. | OK |
| Email verification or password reset | No. Not mentioned in plan. | OK |
| Mobile-optimized layout | No. Desktop layout with fixed-width columns; no mobile breakpoints. | OK |
| Activity log / audit trail | No. Not mentioned in plan. | OK |
| Search or filter | No. Not mentioned in plan. | OK |
| Dark mode | No. Not mentioned in plan. | OK |

## Constraint Check

| Constraint | Respected? | Status |
|---|---|---|
| SQLite via better-sqlite3, no external DB server | Yes. Schema uses CREATE TABLE IF NOT EXISTS on startup, file-based DB at data/kanban.db, tests use :memory:. | OK |
| Runnable with `npm install && npm run dev` | Yes. Plan defines `npm run dev` as concurrently starting Vite + Express (via tsx). package.json is created in Task 1-impl. | OK |
| No real-time sync | Yes. No WebSockets, SSE, or polling. Decisions log explicitly states "refresh to see changes." | OK |
| Minimal dependencies | Yes. Runtime deps are only those in PRD tech stack plus necessary middleware (cookie-parser, bcrypt, jsonwebtoken). Toast is custom (not react-toastify). No react-router (conditional rendering instead). No cors package. | OK |
| Proper HTTP status codes | Yes. API contracts specify 201, 200, 400, 401, 404, 409 as appropriate. | OK |
| Consistent JSON error shapes | Yes. All errors return `{ error: string }`. Error handler middleware enforces this. | OK |

## Context Budget Check

| Task | Files | Status |
|---|---|---|
| Task 1-test | 1 (server/__tests__/db.test.ts) | OK |
| Task 1-impl | 4 (package.json, tsconfig.json, vitest.config.ts, server/db/index.ts) | OK |
| Task 2-test | 2 (server/__tests__/app.test.ts, server/__tests__/helpers.ts) | OK |
| Task 2-impl | 4 (server/app.ts, server/index.ts, server/middleware/auth.ts, server/middleware/error.ts) | OK |
| Task 3-test | 1 (server/__tests__/auth.routes.test.ts) | OK |
| Task 3-impl | 3 (server/routes/auth.ts, server/routes/users.ts, server/app.ts) | OK |
| Task 4-test | 1 (server/__tests__/tasks.routes.test.ts) | OK |
| Task 4-impl | 2 (server/routes/tasks.ts, server/app.ts) | OK |
| Task 5-test | 1 (src/__tests__/api.test.ts) | OK |
| Task 5-impl | 5 (vite.config.ts, tailwind.config.js, index.html, src/main.tsx, src/api/client.ts) | OK |
| Task 6-test | 2 (src/__tests__/useAuth.test.tsx, src/__tests__/LoginForm.test.tsx) | OK |
| Task 6-impl | 4 (src/hooks/useAuth.tsx, src/components/LoginForm.tsx, src/components/RegisterForm.tsx, src/App.tsx) | OK |
| Task 7-test | 2 (src/__tests__/Board.test.tsx, src/__tests__/Column.test.tsx) | OK |
| Task 7-impl | 3 (src/components/Board.tsx, src/components/Column.tsx, src/hooks/useTasks.ts) | OK |
| Task 8-test | 2 (src/__tests__/TaskCard.test.tsx, src/__tests__/EditTaskModal.test.tsx) | OK |
| Task 8-impl | 3 (src/components/TaskCard.tsx, src/components/CreateTaskForm.tsx, src/components/EditTaskModal.tsx) | OK |
| Task 9-test | 2 (src/__tests__/Toast.test.tsx, src/__tests__/BoardHeader.test.tsx) | OK |
| Task 9-impl | 4 (src/components/Toast.tsx, src/components/BoardHeader.tsx, src/components/Board.tsx, src/components/Column.tsx) | OK |

Note: Task 5-impl is at exactly 5 files (the maximum). This is acceptable but leaves no room for additions. The description also mentions postcss.config.js and src/index.css which are not listed in the Files field -- if those need to be created, the task would exceed 5 files. See flagged issue below.

## TDD Check

| Impl Task | Preceding Test Task | Status |
|---|---|---|
| Task 1-impl | Task 1-test | OK |
| Task 2-impl | Task 2-test | OK |
| Task 3-impl | Task 3-test | OK |
| Task 4-impl | Task 4-test | OK |
| Task 5-impl | Task 5-test | OK |
| Task 6-impl | Task 6-test | OK |
| Task 7-impl | Task 7-test | OK |
| Task 8-impl | Task 8-test | OK |
| Task 9-impl | Task 9-test | OK |

All impl tasks have explicit `Dependencies: Task N-test` ensuring tests are written first. No test task references implementation from its own pair.

Dependency chain integrity:
- Task 1-test: no dependencies (correct -- tests db module in isolation)
- Task 2-test depends on Task 1-impl (correct -- needs db module to create test app)
- Task 3-test depends on Task 2-impl (correct -- needs app + auth middleware)
- Task 4-test depends on Task 2-impl (correct -- needs app + auth middleware)
- Task 5-test: no dependencies (correct -- tests frontend client with mocked fetch)
- Task 6-test depends on Task 5-impl (correct -- needs api client module to mock)
- Task 7-test depends on Task 6-impl (correct -- needs auth context + app shell)
- Task 8-test depends on Task 7-impl (correct -- needs Board/Column components)
- Task 9-test depends on Task 8-impl (correct -- needs TaskCard and Board components)

## Flagged Issues

### ISSUE 1: Task 5-impl may exceed 5-file budget (MINOR)

Task 5-impl lists 5 files: vite.config.ts, tailwind.config.js, index.html, src/main.tsx, src/api/client.ts. However, the description also says "Create postcss.config.js and src/index.css with Tailwind directives." These 2 files are not listed in the Files field. If the implementer creates them, the task touches 7 files.

**Recommendation:** Either (a) add postcss.config.js and src/index.css to the Files list and split the task (e.g., move some files to a separate scaffold task), or (b) remove vite.config.ts from this task since it could be created in Task 1-impl alongside tsconfig.json.

### ISSUE 2: RegisterForm tests not in a separate test file (MINOR)

Task 6-test lists src/__tests__/LoginForm.test.tsx but the description says it also tests RegisterForm. The project structure shows RegisterForm.tsx as a separate component. This is not a blocker (tests can live in the same file), but differs from the pattern established by other tasks where each component has its own test file.

**Recommendation:** Either add src/__tests__/RegisterForm.test.tsx to Task 6-test's file list, or note explicitly that RegisterForm tests live in LoginForm.test.tsx.

### ISSUE 3: CreateTaskForm tests grouped into Task 8-test (MINOR)

Task 8-test lists files TaskCard.test.tsx and EditTaskModal.test.tsx, but the description also tests CreateTaskForm. No separate CreateTaskForm.test.tsx file is listed, though the project structure in the plan does not list one either. This is consistent within the plan but means CreateTaskForm tests are embedded in one of the other test files.

**Recommendation:** Add src/__tests__/CreateTaskForm.test.tsx to the file list (still within the 5-file budget at 3 files), or clarify which test file contains CreateTaskForm tests.

### ISSUE 4: src/__tests__/setup.ts not assigned to any task (MINOR)

The project structure lists src/__tests__/setup.ts for test setup (testing-library matchers), but no task creates this file. Task 5-impl would be the natural place, but it is already at 5 files.

**Recommendation:** Assign setup.ts creation to Task 6-test or Task 6-impl (which has 4 files, leaving room).

## Summary

The plan is well-aligned with the PRD. All success criteria are covered, no out-of-scope items are implemented, all constraints are respected, TDD pairing is correct throughout, and the overall result is PASS. There are 4 minor issues -- primarily around file counting in Task 5-impl (which may exceed the 5-file budget when accounting for postcss.config.js and src/index.css mentioned in its description but not in its file list) and a few test files that are implicitly grouped rather than explicitly listed. None of these are blockers, but addressing them before implementation would improve clarity.

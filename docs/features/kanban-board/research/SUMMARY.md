# Research Synthesis: Kanban Board Task Manager

## Recommended Approach

Build a React (Vite) + Express.js + SQLite kanban board using @dnd-kit for drag-and-drop, JWT authentication via httpOnly cookies, and Tailwind CSS for styling. The architecture is straightforward: a single Express server with better-sqlite3 (synchronous API, WAL mode) serving a React SPA through Vite's dev proxy. Authentication uses bcrypt for password hashing and a single JWT (7-day expiry) stored in an httpOnly cookie -- no refresh tokens, no localStorage, no manual token attachment.

The frontend is organized around a top-level `AuthProvider` context that gates access to the board. When unauthenticated, users see a combined login/register form. When authenticated, they see the kanban board. No router library is needed -- conditional rendering based on `useAuth()` state is sufficient for this three-view app (loading, login, board).

The kanban board uses a single `DndContext` wrapping three `SortableContext` containers (one per column). Each card uses the `useSortable` hook. A `DragOverlay` (always mounted, content conditionally rendered inside) provides a floating ghost card with shadow-xl and slight rotation during drag. State is modeled as `Record<ColumnId, TaskId[]>` for column ordering, with a separate `Record<TaskId, Task>` lookup map. Drag operations update the UI optimistically; the final position is persisted to the server only on drop via `PATCH /api/tasks/:id/move`.

Position ordering uses REAL-valued midpoint insertion: when a card is placed between two others, its position is the average of its neighbors' positions. This requires updating only one row per move. A periodic rebalance (renumbering all positions in a column to clean integers) triggers when the gap between adjacent positions drops below 0.001 -- rare in practice (approximately 52 consecutive same-gap bisections before it happens).

Task creation uses Trello-style inline forms at the bottom of each column (title-only, Enter to submit). Editing uses a click-to-open centered modal with fields for title, description, and assignee. Deletion requires a simple confirmation dialog inside the edit modal. The board uses skeleton loading (Tailwind's `animate-pulse`) during initial fetch and toast notifications for action feedback.

The SQLite database has two tables (`users`, `tasks`) initialized via `CREATE TABLE IF NOT EXISTS` on startup, with a lightweight version-tracked migration table for future schema changes. The database file lives in a `data/` directory (gitignored) separate from the `db/` source code directory. The connection is a module-scope singleton with lazy initialization, using `:memory:` for tests.

---

## Key Findings

### Drag-and-Drop (@dnd-kit)

- Use three packages: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
- Architecture: one `DndContext` > three `SortableContext` containers > `useSortable` on each card > `DragOverlay` for the ghost.
- The `closestCorners` collision detection algorithm is best for kanban (stacked droppable containers). For even better precision, combine `pointerWithin` (primary) with `closestCorners` (keyboard fallback).
- Empty columns require a `useDroppable` wrapper on the column element itself; `SortableContext` alone provides no drop target when empty.
- The `DragOverlay` must remain mounted at all times -- conditionally render `null` inside it, never unmount the component itself, or drop animations break.
- Use `PointerSensor` with `distance: 8` activation constraint to prevent clicks on card buttons from triggering drags. Include `KeyboardSensor` with `sortableKeyboardCoordinates` for accessibility.
- Clone column state in a ref on `onDragStart` to enable cancel recovery (Escape key restores snapshot).
- Never persist during `onDragOver` (fires on every pointer move); only persist on `onDragEnd`.
- Memoize task cards with `React.memo` to avoid re-rendering unaffected cards during drag.

### SQLite + Express (better-sqlite3)

- better-sqlite3's synchronous API means no `await` needed for database calls inside Express handlers. Queries run sequentially on Node's single thread, eliminating race conditions between concurrent requests.
- Essential pragmas on every connection: `journal_mode = WAL`, `synchronous = NORMAL`, `foreign_keys = ON`, `busy_timeout = 5000`.
- Use `db.exec()` for DDL (schema creation), `db.prepare()` for all DML (queries with parameters). Never use `db.exec()` with user input.
- `db.transaction()` wraps the move/rebalance operation atomically. Transactions cannot contain `await` calls -- do async work before the transaction.
- Use TEXT primary keys (UUIDs) for users and tasks. This is safer for client-side exposure than auto-increment integers.
- Add a composite index on `(column, position)` for the most common query pattern.
- Pass JavaScript `null` (not `undefined`) for SQL NULL in parameterized queries -- `undefined` throws a TypeError.
- Store the database file in `data/kanban.db`, gitignore `data/*.db`, `data/*.db-wal`, `data/*.db-shm`.
- Register `SIGINT`/`SIGTERM` handlers to close the database on shutdown (triggers WAL checkpoint).

### Authentication (JWT + httpOnly Cookies)

- Store the JWT in an httpOnly cookie (`SameSite=lax`, `Secure` in production). This prevents XSS token theft and sends the cookie automatically with every request.
- CSRF is mitigated by `SameSite=lax` (blocks cross-site POST) combined with `Content-Type: application/json` (browsers cannot send JSON from HTML forms).
- No refresh tokens needed. A single 7-day access token is sufficient for this app's simplicity level. If it expires, the user logs in again.
- The frontend API client must use `credentials: 'include'` on every fetch call, or the cookie is not sent.
- On page load, call `GET /api/auth/me` to check if the cookie is still valid. Show a loading spinner during this check to prevent a flash of the login form.
- Use bcrypt with 10 salt rounds (async API only -- sync blocks the event loop). Return generic "Invalid email or password" on login failure to prevent user enumeration.
- `res.clearCookie()` must receive the exact same options (`httpOnly`, `secure`, `sameSite`, `path`) that were used to set the cookie, or the browser silently ignores the clear.
- Vite's dev proxy (`/api` -> `http://localhost:3001`) makes cookies same-origin in development, avoiding CORS issues entirely.
- Wrap async Express handlers in try/catch or use an `asyncHandler` utility, since Express 4.x does not catch promise rejections.

### UX and Design (Tailwind CSS)

- Board layout: horizontal flex container (`overflow-x-auto`) with three fixed-width columns (`w-80` / 320px) on a `bg-gray-50` background.
- Card design: white background, `shadow-sm`, `rounded-lg`, `p-3`. Show title (bold, 2-line clamp), 1-line description preview (muted text), assignee initials avatar (bottom-right). Hover adds `shadow-md`.
- Drag overlay: `shadow-xl`, `rotate-2`, `scale-105`, `border-blue-300`. Original card position shows at `opacity-30` as a placeholder.
- Column headers: sticky, with column title, task count badge, and a "+" button. Optional color-coded dots (slate for To Do, blue for In Progress, green for Done).
- Empty column state: dashed border container with "No tasks yet" and "+ Add a task" link. The empty area must remain a valid drop target.
- Inline creation form (Trello-style): replaces the "+ Add a card" button, auto-focused title input, Enter to submit, Escape to cancel, form stays open for rapid creation.
- Edit modal: centered overlay, fields for title (inline editable), description (textarea), and assignee (dropdown). Delete button in footer with simple confirmation dialog.
- Loading: skeleton cards with `animate-pulse`. Errors: toast notifications (bottom-right, auto-dismiss on success, persist on error). No need for react-toastify -- a lightweight custom toast is sufficient.

---

## Risks & Mitigations

### Technical Risks

**Optimistic update rollback on failed persist.** If the PATCH request to save a card move fails after the UI has already updated optimistically, the board shows incorrect state. **Mitigation:** On server error, show an error toast and refetch the full board state from the server, resetting the UI to the last known good state.

**Concurrent edits (last-write-wins).** Two users moving the same card simultaneously results in the second write overwriting the first. **Mitigation:** This is acceptable per the PRD ("refresh to see changes"). No real-time sync is needed. If this becomes a problem later, optimistic concurrency control using a `version` column on tasks can be added without architectural changes.

**better-sqlite3 blocking the event loop.** Long-running queries or large rebalance operations could freeze the Express server. **Mitigation:** For a kanban board with dozens of tasks per column, queries run in microseconds. This is a non-risk at the expected scale. If the app scales to thousands of tasks per column (unlikely given single-board scope), consider offloading to a worker thread.

**JWT cannot be revoked once issued.** If a user's session is compromised, the token remains valid for up to 7 days. **Mitigation:** Acceptable for this app's threat model. For higher security, a server-side token blacklist could be added later, but it is out of scope.

**Cookie not sent in production without HTTPS.** The `secure: true` flag means the cookie is silently dropped on HTTP connections. **Mitigation:** Document that production deployment requires HTTPS. The Vite proxy in development avoids this issue by making everything same-origin.

### UX Risks

**Accidental card movement during click.** Without a drag activation threshold, clicking on a card to open the edit modal could accidentally trigger a drag. **Mitigation:** The `PointerSensor` `distance: 8` constraint requires 8px of pointer movement before a drag starts, allowing normal clicks to pass through.

**No visual indicator that other users' changes exist.** Since there is no real-time sync, users may work with stale data without knowing it. **Mitigation:** Add a visible "Refresh" button in the board header. The PRD explicitly calls out manual refresh as the update mechanism.

**Empty column drop target confusion.** Users may not realize they can drop cards into an empty column if it looks collapsed or blank. **Mitigation:** Always render empty columns with a dashed border placeholder and "No tasks yet" text. The `useDroppable` hook on the column element ensures the entire column area is a valid drop target.

---

## Open Decisions

All decisions have been resolved:

1. **Primary key type:** **UUID (TEXT).** Use UUID v4 for all primary keys. More secure, prevents enumeration, safer for client-side exposure.

2. **Position column type:** **REAL.** Required for midpoint insertion strategy (1 DB write per move). PRD's INTEGER was an oversight.

3. **Inline create form behavior:** **Keep open after adding a card (Trello-style).** Optimizes for rapid card creation. Form stays open with cleared input, ready for the next card.

4. **Column dropdown in edit modal:** **Yes, include it.** Small implementation effort, provides accessible alternative to drag-and-drop for column changes.

5. **Rate limiting on auth endpoints:** **No, deferred.** Not needed for MVP. Can be added later if needed.

6. **Server-side JWT revocation on logout:** **Yes, add a blacklist table.** A `revoked_tokens` table stores invalidated JWTs. The `requireAuth` middleware checks this table before granting access. Tokens are cleaned up periodically (or on startup) by removing expired entries.

7. **Refresh button in board header:** **Yes, include it.** Better UX than relying on browser reload. A simple button that refetches all tasks.

---

## Conflicts

### Primary Key Type: INTEGER vs. UUID

The PRD data model specifies `INTEGER` primary keys with auto-increment. The SQLite + Express research recommends `TEXT` primary keys with UUID v4, arguing they are safer for client-side exposure, avoid sequential enumeration, and are better for distributed systems. The auth research follows the PRD and uses `INTEGER` (`userId: number` in the JWT payload).

**Trade-off:** UUIDs are more secure and flexible but slightly larger in storage and less human-readable during debugging. For a small single-server app with no mobile clients generating IDs offline, INTEGER is simpler and matches the PRD. UUIDs are the more "modern" choice but introduce a deviation from the PRD spec.

**Recommendation:** Use UUIDs (TEXT) unless there is a strong reason to follow the PRD literally. The security and flexibility benefits outweigh the marginal complexity increase.

### Position Column Type: INTEGER vs. REAL

The PRD specifies `position INTEGER`. Both the dnd-kit research and the SQLite research independently recommend `position REAL` for the midpoint insertion strategy. Using INTEGER would require renumbering every task in the destination column on every drag-and-drop move, which is more writes and more complex transaction logic.

**Trade-off:** There is no practical reason to use INTEGER here. This is almost certainly a PRD oversight, as INTEGER positions only work cleanly with a "renumber all on every move" strategy.

**Recommendation:** Use REAL. All researchers agree on this.

### Task Creation UX: Inline Form vs. Modal

The UX research recommends Trello-style inline creation (title-only form at the bottom of each column). This is lower friction and better for rapid card creation. However, the PRD says "Create a new task (title required, description and assignee optional)" which could be interpreted as supporting a creation modal with all three fields.

**Trade-off:** Inline creation is faster but only captures the title; description and assignee must be added in a separate edit step. A creation modal captures all fields at once but is higher friction and interrupts the board flow.

**Recommendation:** Use inline creation (title-only) for the primary flow. Users can immediately click the newly created card to add description and assignee. This matches Trello's proven UX pattern and satisfies the PRD requirement (description and assignee are optional on creation).

### Error Handling After Failed Drag: Rollback vs. Refetch

The dnd-kit research notes that the current optimistic update pattern does not address what happens when the server rejects a move. It suggests showing an error toast and refetching. The UX research recommends toast notifications for all action errors.

**Trade-off:** A clean rollback (restoring the pre-drag state from the cloned snapshot) is faster but may miss other changes that happened since the page loaded. A full refetch is simpler to implement and guarantees correctness but causes a visual "jump" as all cards reposition.

**Recommendation:** Refetch the full board state on server error. The brief visual reset is acceptable since server errors during drag should be rare, and it ensures the UI is always consistent with the database.

### Routing: No Router vs. React Router

The auth research explicitly states "no react-router needed" and uses conditional rendering in `App.tsx`. This works for the current three-view scope (loading, login, board) but would not scale if views are added later (e.g., a profile page).

**Trade-off:** Adding react-router now is a small upfront cost that pays off if the app grows. Not adding it keeps dependencies minimal per the PRD constraint.

**Recommendation:** Skip react-router for MVP. The conditional rendering approach is sufficient. If scope creeps to include more views, it can be added later without significant refactoring.

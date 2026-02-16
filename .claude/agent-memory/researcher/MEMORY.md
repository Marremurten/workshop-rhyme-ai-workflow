# Researcher Agent Memory

## Project Structure
- Project root: `/Users/martinnordlund/claudeteams` (NOT the workshop subdirectory)
- Backend: Express + TypeScript at `server/`
- Frontend: React 18 + Vite SPA at `src/`
- Database: SQLite via better-sqlite3 at `db/`
- Tests: Vitest at `tests/`
- Research output: `docs/features/<feature>/research/`

## Key Architectural Patterns
- Auth: express-session + custom SQLiteStore + bcrypt, Zustand auth store on frontend
- Session cookie: `taskmanager.sid`, httpOnly, SameSite=lax, 7-day expiry
- API utility: `src/hooks/useApi.ts` with global 401 interceptor and `credentials: 'include'`
- Auth gate: Conditional rendering in App.tsx (no react-router-dom)
- Vite proxy: `/api` -> `http://localhost:3001`, Socket.IO WebSocket proxy also configured
- CSRF: SameSite=lax + Content-Type:application/json header (no separate token library)
- Rate limiting: express-rate-limit on auth endpoints, disabled in test env

## Database Patterns
- UUIDs (TEXT PRIMARY KEY) generated via `uuid` v4 -- consistent across all tables
- REAL-valued `position` column with midpoint insertion + auto-rebalance when gap < 0.001
- Optimistic concurrency via `version INTEGER` field (WHERE id = ? AND version = ?)
- Singleton `getDb()` in db/schema.ts, `:memory:` for tests, WAL mode for production
- `CREATE TABLE IF NOT EXISTS` for idempotent setup, migrations as functions
- Transactions: `db.transaction(() => { ... })()` -- synchronous only, no async
- Rebalance pattern: CASE-WHEN bulk update to renumber positions as 1.0, 2.0, 3.0, ...

## API Conventions
- PATCH for partial updates (not PUT) -- existing pattern in routes/tasks.ts
- Validation middleware functions in server/middleware/validate.ts
- Error helpers: notFound(), badRequest(), conflict() from server/middleware/errors.ts
- requireAuth middleware sets req.user from session
- Task responses: full task objects; errors: { error, code, details? }

## Research Approaches That Work
- Always check existing codebase FIRST -- this project already had auth fully implemented
- Read server/index.ts for middleware stack and route mounting order
- Read db/schema.ts for all table definitions and migrations
- Use `Grep` with auth-related terms across `**/*.ts` to find all relevant files
- WebSearch for OWASP guidance on security topics provides authoritative recommendations
- Compare existing implementation against best practices rather than researching from scratch
- For library research: search official docs, DeepWiki summaries, and multiple tutorial blogs
- When WebFetch is unavailable, use targeted WebSearch queries with code snippets in quotes
- dnd-kit official repo stories/ folder has canonical examples (e.g., MultipleContainers.tsx)

## DnD-Kit Kanban Patterns (Researched)
- See detailed research: `docs/features/kanban-board/research/dnd-kit-patterns.md`
- Packages: @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
- Pattern: DndContext > SortableContext per column > useSortable per card > DragOverlay
- Collision: closestCorners for kanban (or custom pointerWithin+closestCorners combo)
- State: Record<ColumnId, TaskId[]> with separate tasks map
- Handlers: onDragStart (snapshot), onDragOver (cross-column move), onDragEnd (persist)
- DragOverlay: always mounted, presentational component only (no useSortable inside)
- Position persistence: REAL midpoint insertion matches existing codebase pattern

## JWT Auth Patterns (Researched)
- See detailed research: `docs/features/kanban-board/research/auth-patterns.md`
- Recommendation: JWT in httpOnly cookie (not localStorage) -- OWASP-aligned
- CSRF: SameSite=lax + Content-Type:application/json -- no separate token library
- Packages: jsonwebtoken, bcrypt, cookie-parser (+ @types/* for each)
- bcrypt: 10 salt rounds, async API only, timing-safe compare
- Middleware: extract token from req.cookies, jwt.verify, attach to req.user
- Frontend: React Context + useAuth hook, fetch wrapper with credentials:'include'
- Auth gate: conditional render in App.tsx (loading -> login -> board)
- Vite proxy makes cookies work same-origin in dev
- No refresh tokens needed for simple app -- 7-day access token expiry
- Key gotcha: clearCookie must use same options as setCookie or browser ignores it

## Kanban UX Patterns (Researched)
- See detailed research: `docs/features/kanban-board/research/kanban-ux.md`
- Layout: horizontal flex, fixed-width columns (w-80/320px), overflow-x-auto
- Cards: white bg, shadow-sm, title (line-clamp-2), desc preview (line-clamp-1), assignee initials
- Creation: Trello-style inline form at column bottom (title-only, Enter to submit)
- Editing: click card -> centered modal with title/description/assignee fields
- Drag feedback: DragOverlay with shadow-xl + rotate-2, original at opacity-30
- Key reference: Georgegriff/react-dnd-kit-tailwind-shadcn-ui

## SQLite + Express Patterns (Researched)
- See detailed research: `docs/features/kanban-board/research/sqlite-express.md`
- Singleton pattern: module-scope getDb() with lazy init, not class-based Singleton
- Essential pragmas: WAL, synchronous=NORMAL, foreign_keys=ON, busy_timeout=5000
- Schema: CREATE TABLE IF NOT EXISTS for idempotent setup
- Migrations: simple version table + numbered migration functions in transactions
- Position strategy: REAL midpoint insertion + rebalance at gap < 0.001
- Transactions: db.transaction synchronous only, no await inside
- Gotchas: foreign_keys OFF by default, undefined throws (use null)
- Graceful shutdown: SIGINT/SIGTERM -> server.close -> closeDb -> process.exit
- Testing: :memory: databases, optional db injection for query functions
- PRD deviations flagged: INTEGER->TEXT(UUID) for PKs, INTEGER->REAL for position

## Files to Check for Any Feature Research
- `server/index.ts` - middleware stack, route mounting, security config
- `db/schema.ts` - all table definitions
- `db/queries.ts` - all database query functions
- `server/types.ts` - shared TypeScript types
- `src/types.ts` - frontend TypeScript types
- `vite.config.ts` - dev proxy, test config
- `package.json` - installed dependencies

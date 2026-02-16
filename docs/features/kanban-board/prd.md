# PRD: Kanban Board Task Manager

## Overview

A simple, shared kanban board for task management with email/password authentication. Multiple users collaborate on a single board, moving tasks through fixed columns via drag-and-drop. Not real-time — users refresh to see changes from others.

## Goals

- Provide a clean, intuitive kanban board experience
- Simple authentication so multiple users can share one board
- Nice UX with smooth drag-and-drop interactions
- Keep the system simple — no live sync, no complex permissions

## Tech Stack

| Layer      | Technology              |
| ---------- | ----------------------- |
| Frontend   | React (Vite)            |
| Backend    | Express.js              |
| Database   | SQLite (via better-sqlite3) |
| Auth       | Email/password + JWT    |
| Styling    | Tailwind CSS            |
| DnD        | @dnd-kit/core           |

## In Scope

### 1. Authentication
- User registration with email + password
- User login returning a JWT token
- Protected API routes (JWT middleware)
- Logout (client-side token removal)
- Passwords hashed with bcrypt

**Success criteria:** Users can register, log in, and access the board. Unauthenticated requests are rejected with 401.

### 2. Kanban Board
- Single shared board visible to all authenticated users
- Three fixed columns: **To Do**, **In Progress**, **Done**
- Drag-and-drop cards between columns (using @dnd-kit)
- Card ordering within columns preserved

**Success criteria:** Users see all three columns with their cards. Cards can be dragged between columns and the new position persists after refresh.

### 3. Task Cards
- Create a new task (title required, description and assignee optional)
- Edit task title, description, and assignee
- Delete a task
- Assignee is selected from a dropdown of registered users
- Cards display title, assignee avatar/name, and a truncated description

**Success criteria:** Full CRUD on tasks. Assignee dropdown shows all registered users. Card content is visible at a glance.

### 4. UX & Design
- Clean, modern UI with Tailwind CSS
- Responsive layout (works on desktop; tablet acceptable, mobile not required)
- Smooth drag-and-drop animations
- Loading states and error feedback (toasts or inline)
- Empty states for columns with no tasks

**Success criteria:** The board feels polished. Drag interactions are smooth. Users get feedback on all actions (success/error).

### 5. Data Refresh
- Manual refresh: user reloads the page or clicks a refresh button to see others' changes
- No WebSockets or polling

**Success criteria:** After another user creates/moves a task, refreshing the page shows the updated state.

## Out of Scope

- **Real-time/live updates** — no WebSockets, SSE, or polling
- **Multiple boards** — single shared board only
- **Custom columns** — columns are fixed (To Do, In Progress, Done)
- **User roles/permissions** — all users are equal, anyone can edit/delete any task
- **Due dates, labels, priorities** — task cards have title, description, assignee only
- **File attachments** on cards
- **Email verification** or password reset flows
- **Mobile-optimized layout** (desktop-first, tablet acceptable)
- **Activity log / audit trail**
- **Search or filter** on tasks
- **Dark mode** (unless trivial to add with Tailwind)

## Constraints

- SQLite is the database — no external DB server needed. The app should be runnable with `npm install && npm run dev`.
- No real-time sync. The mental model is: "refresh to see changes."
- Keep dependencies minimal. No heavy UI frameworks beyond what's listed.
- All API responses should return proper HTTP status codes and consistent JSON error shapes.

## Data Model (Conceptual)

### Users
| Field          | Type    | Notes                |
| -------------- | ------- | -------------------- |
| id             | INTEGER | Primary key          |
| email          | TEXT    | Unique               |
| name           | TEXT    | Display name         |
| password_hash  | TEXT    | bcrypt               |
| created_at     | TEXT    | ISO timestamp        |

### Tasks
| Field       | Type    | Notes                          |
| ----------- | ------- | ------------------------------ |
| id          | INTEGER | Primary key                    |
| title       | TEXT    | Required                       |
| description | TEXT    | Optional                       |
| column      | TEXT    | "todo" / "in_progress" / "done"|
| position    | INTEGER | Order within column            |
| assignee_id | INTEGER | FK to users (nullable)         |
| created_by  | INTEGER | FK to users                    |
| created_at  | TEXT    | ISO timestamp                  |
| updated_at  | TEXT    | ISO timestamp                  |

## API Endpoints (Draft)

### Auth
- `POST /api/auth/register` — create account
- `POST /api/auth/login` — get JWT
- `GET /api/auth/me` — get current user

### Users
- `GET /api/users` — list all users (for assignee dropdown)

### Tasks
- `GET /api/tasks` — get all tasks
- `POST /api/tasks` — create task
- `PUT /api/tasks/:id` — update task (title, description, assignee, column, position)
- `DELETE /api/tasks/:id` — delete task
- `PATCH /api/tasks/:id/move` — move task to a new column/position (dedicated endpoint for drag-and-drop)

## Suggested Research Areas (Phase 1)

1. **@dnd-kit integration patterns** — Best practices for kanban-style drag-and-drop with sortable columns. How to handle card reordering within and across columns.
2. **JWT auth with Express + React** — Token storage strategy (httpOnly cookie vs localStorage), middleware pattern, refresh token considerations.
3. **SQLite with Express** — better-sqlite3 setup patterns, migration strategy, connection management.
4. **Kanban UI reference designs** — Study existing open-source kanban boards (e.g., react-kanban, Trello clones) for UX patterns around card layout, column sizing, and empty states.

## Feature Size Assessment

This is a **single feature** — no need to split into parts. The scope is intentionally small:
- ~5 API endpoints
- ~3-4 React pages/views (login, register, board)
- 2 DB tables
- Straightforward CRUD with drag-and-drop

Estimated complexity: **Medium** — the drag-and-drop UX is the most involved piece, but the data model and API are simple.

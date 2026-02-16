# Kanban Board UX Patterns Research

## Summary

Modern kanban boards follow a consistent set of UX conventions established by Trello, Linear, and Jira: fixed-width columns in a horizontal flex container, compact cards showing only essential metadata (title, assignee, truncated description), and smooth drag-and-drop with a floating overlay clone and a visible drop placeholder. For our React + Tailwind + @dnd-kit implementation, the recommended approach is Trello-style inline creation at the bottom of each column, click-to-open modal editing for full task details, and a DragOverlay portal with a slightly rotated/elevated ghost card for drag feedback.

---

## 1. Overall Layout Approach

### Board Container

The board is a full-width horizontal flex container with overflow-x scrolling. Each column is a fixed-width flex child. This pattern is universal across Trello, Linear, Jira, and every major open-source kanban implementation.

**Recommended structure:**

```
Board (flex, horizontal, overflow-x-auto)
  +-- Column (fixed width, flex-col, overflow-y-auto)
  |     +-- Column Header (sticky top)
  |     +-- Card List (flex-col, gap)
  |     +-- Add Card Button / Inline Form
  +-- Column
  +-- Column
```

**Key layout decisions:**

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Column width | Fixed (280-320px) | Consistent card sizing, predictable layout, matches Trello/Linear |
| Horizontal scroll | `overflow-x-auto` on board | Supports future column additions; standard pattern |
| Vertical scroll | `overflow-y-auto` on card list area | Each column scrolls independently when cards exceed viewport height |
| Column height | `h-full` or `calc(100vh - header)` | Columns should fill the available viewport height |
| Board background | Subtle neutral (gray-100/slate-100) | Distinguishes the board from the page chrome |

**Why fixed width over flexible:** With only 3 fixed columns, flexible width would work fine. However, fixed width (around 300px) is the established convention because it keeps card text readable and provides consistent visual rhythm. For 3 columns on a typical 1440px screen, 300px columns with gaps fit comfortably without horizontal scrolling, but the scroll mechanism should be in place for robustness.

### Visual Hierarchy

- Board background: lightest neutral (gray-50 or slate-100)
- Column background: slightly darker neutral or white with border (white/gray-50 with gray-200 border)
- Card background: white with subtle shadow
- This creates three clear depth layers: board > column > card

---

## 2. Card Design Patterns

### Information Density

Research across Trello, Linear, Jira, and open-source implementations reveals a consistent hierarchy of what to show on a card:

**Always visible (on the card face):**
1. **Title** -- The most prominent element; bold, 14-16px, truncated to 2-3 lines max
2. **Assignee** -- Avatar (circle, 24-28px) or initials badge, positioned at bottom-right or top-right of the card
3. **Description indicator** -- A small icon or 1-line preview (not full description); Linear shows nothing, Trello shows a description icon

**Not shown on card face (available on click/detail view):**
- Full description text
- Created date, updated date
- Creator name

**For our PRD scope** (title required, description optional, assignee optional):
- Show: title (bold, 2 lines max with truncation), assignee avatar/initials (bottom-right), description preview (1 line, muted text, only if description exists)
- This matches the PRD requirement: "Cards display title, assignee avatar/name, and a truncated description"

### Card Sizing

| Property | Recommended Value | Notes |
|----------|-------------------|-------|
| Width | Full column width minus padding | Cards fill the column; typically ~260-280px of content |
| Min height | None (content-driven) | Cards should be as compact as possible |
| Padding | 12-16px (p-3 to p-4) | Enough breathing room without wasting space |
| Border radius | 8px (rounded-lg) | Modern, soft appearance |
| Shadow | shadow-sm on rest, shadow-md on hover | Subtle depth, interactive affordance on hover |
| Gap between cards | 8px (gap-2) | Tight but scannable |

### Card Visual States

- **Default:** White background, shadow-sm, gray-200 border or no border
- **Hover:** shadow-md, slight scale or border-color change (e.g., border-blue-300)
- **Dragging (original position):** Reduced opacity (opacity-50) or dashed border placeholder
- **Drag overlay (ghost following cursor):** shadow-lg, slight rotation (rotate-3), slightly elevated appearance
- **Focus (keyboard navigation):** ring-2 ring-blue-500 outline

### Card Interaction

- **Cursor:** `cursor-grab` on hover, `cursor-grabbing` while dragging
- **Click target:** The entire card is clickable to open the detail/edit view
- **Drag handle vs. full card drag:** For simplicity (and matching Trello), the entire card is the drag handle. A dedicated drag grip icon (6 dots) is optional and better for touch devices but adds complexity.

---

## 3. Column Design Patterns

### Column Header

The column header is the identity of each column and should include:

1. **Column title** -- "To Do", "In Progress", "Done" -- bold, 14-16px, semibold weight
2. **Task count badge** -- Number of cards in the column, shown as a muted count next to the title (e.g., "To Do (3)")
3. **Add task button** -- A "+" icon button in the header, or an "Add a card" action at the bottom of the column

**Header layout:** Flex row with title+count on the left, add button on the right. The header should be sticky (sticky top-0) so it remains visible when the column scrolls vertically.

**Column-specific color coding (optional but recommended):**
- To Do: Neutral/gray accent (slate-400 dot or left-border)
- In Progress: Blue/amber accent (blue-500 dot or left-border)
- Done: Green accent (green-500 dot or left-border)

This can be a small colored dot or a 3px left border on the column header. Linear uses small colored dots; Trello uses no color coding on columns.

### Empty States

When a column has no cards, it should not collapse or disappear. Best practices:

**Recommended empty state design:**
- Show a dashed border area or a subtle message: "No tasks yet"
- Include an inline call-to-action: "Add a task" link or the same "+" button
- Use a muted, friendly tone -- not just blank space
- The empty area should still be a valid drop target for drag-and-drop

**Tailwind implementation:**
```
border-2 border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-400
```

This creates a clear visual indication that (a) the column is empty, (b) the empty space is intentional, and (c) cards can be dropped here.

**What to avoid:**
- Completely blank columns (users won't know they can drop cards there)
- Overly elaborate illustrations or animations for empty states (this is a simple tool)
- Humor or mascots (inappropriate for a productivity tool aimed at teams)

### Column Footer

The bottom of each column should have an "Add a card" action. Trello places this at the very bottom as a text link ("+ Add a card"). This is the primary creation entry point and should be always visible without scrolling if possible (sticky bottom or placed below the scroll area).

---

## 4. Task Creation and Editing UX

### Task Creation: Inline Form (Recommended)

**Pattern: Trello-style inline creation at the bottom of the column.**

When the user clicks "+ Add a card" at the bottom of a column:
1. The link/button transforms into a compact inline form
2. A text input appears (auto-focused) for the task title
3. Two buttons appear below: "Add Card" (primary) and "X" (cancel)
4. Pressing Enter submits; pressing Escape cancels
5. After submission, the form stays open for rapid card creation (Trello behavior)
6. Clicking outside the form closes it

**Why inline over modal for creation:**
- Lower friction -- the user stays in context on the board
- Faster for creating multiple cards in sequence
- Title-only creation is sufficient; description and assignee can be added later via edit
- Matches user expectations from Trello, the most widely-used kanban tool

**Why not a modal for creation:**
- Modals interrupt flow and require explicit dismissal
- For a simple "title only" initial creation, a modal is overkill
- Modals are better when the creation form has many required fields

**Implementation notes:**
- The inline form replaces the "+ Add a card" button when active
- On submit, send POST to /api/tasks with title and column, then optimistically add the card
- The form should only require the title; assignee and description are added via the edit flow

### Task Editing: Click-to-Open Modal (Recommended)

**Pattern: Click the card to open a centered modal with full task details.**

When the user clicks a card:
1. A modal overlay appears with the full task detail form
2. Fields: Title (editable inline), Description (textarea), Assignee (dropdown of users)
3. A "Delete" button (red, secondary) for destructive action
4. Close via X button, Escape key, or clicking the overlay backdrop

**Why a modal for editing over inline editing:**
- Editing involves multiple fields (title, description, assignee) -- inline editing of all three on the small card would be cluttered
- The modal provides a focused editing environment
- It matches Linear and Trello patterns (click card -> detail view)
- The card on the board stays clean and compact

**Why not a slide-out panel:**
- A side panel is more appropriate for apps with deep detail (Jira, Linear with sub-issues, comments, activity)
- Our task model is simple (title, description, assignee) -- a modal is sufficient
- Slide-out panels require more layout considerations and can feel heavy for simple data

**Modal structure:**
```
+----------------------------------+
| Task Title (editable, bold)    X |
+----------------------------------+
| Description                      |
| [textarea, placeholder text]     |
|                                  |
| Assignee                         |
| [dropdown: select a user]        |
|                                  |
| Column                           |
| [dropdown: To Do / In Progress / |
|  Done] (optional, since drag     |
|  handles this)                   |
|                                  |
+----------------------------------+
| [Delete Task]          [Save]    |
+----------------------------------+
```

### Delete Confirmation

For deleting a task from within the edit modal:

**Recommended pattern: Simple confirmation dialog (low-friction).**

- Clicking "Delete" shows a small confirmation: "Delete this task? This cannot be undone."
- Two buttons: "Cancel" (neutral) and "Delete" (red/destructive)
- No need for typed confirmation -- tasks are low-severity (not account deletion)
- The red color on the delete button provides sufficient visual warning

**Why simple confirmation over undo-toast:**
- An undo toast (like Gmail) is great UX but requires soft-delete infrastructure
- For MVP simplicity, a confirmation dialog is appropriate
- The action is destructive but not catastrophic (it's a task card, not an account)

**Why not no confirmation at all:**
- Accidental deletions happen, especially near drag-and-drop interactions
- A single confirmation click is minimal friction for preventing mistakes

---

## 5. Drag-and-Drop Feedback

### @dnd-kit Implementation Pattern

The established pattern for kanban drag-and-drop with @dnd-kit uses these components:

- **DndContext** -- Wraps the entire board
- **SortableContext** -- One per column, wrapping the card list
- **useSortable** -- Hook on each card for drag/sort behavior
- **DragOverlay** -- Portal-rendered ghost card that follows the cursor

### Visual Feedback Stages

**1. Drag Start:**
- The original card becomes a placeholder (reduced opacity or dashed border)
- A DragOverlay clone appears under the cursor
- Cursor changes to `cursor-grabbing`

**2. During Drag (over same column):**
- Other cards animate smoothly to make space for the drop position
- The SortableContext handles this automatically with CSS transitions
- The drop position is indicated by the gap created between cards

**3. During Drag (over different column):**
- The target column subtly highlights (e.g., bg-blue-50 or border-blue-300)
- Cards in the target column shift to create space at the insertion point
- The source column shows the gap where the card was removed

**4. Drop:**
- The DragOverlay animates to the final position (drop animation)
- The placeholder is replaced by the actual card
- A brief success state (optional, could be a subtle flash or nothing)

**5. Cancel (Escape or drop outside):**
- The DragOverlay animates back to the original position
- All cards return to their original positions

### DragOverlay Styling

The DragOverlay should be visually distinct from resting cards:
- **Elevated shadow:** shadow-xl (much larger than resting shadow-sm)
- **Slight rotation:** transform rotate-2 or rotate-3 (gives a "picked up" feel)
- **Slight scale:** scale-105 (optional, subtle size increase)
- **Background:** Same white as the card, or very slightly blue-tinted
- **Border:** Could add a blue border (border-blue-400) for emphasis
- **Opacity:** Fully opaque (1.0) -- the overlay should look like the real card

### Placeholder Styling (Original Position)

When a card is being dragged, the original position should show:
- **Option A (Recommended):** Reduced opacity (opacity-30) of the original card -- shows where it came from
- **Option B:** A dashed border empty space matching the card dimensions
- **Option C:** Nothing (the gap closes) -- less common, can be disorienting

### Accessibility Considerations

- Keyboard support: Tab to card, Space/Enter to pick up, Arrow keys to move, Space/Enter to drop
- ARIA attributes: `aria-grabbed`, `aria-dropeffect`, live region announcements
- @dnd-kit provides keyboard sensors and screen reader announcements out of the box
- Ensure all drag operations can be performed via keyboard

---

## 6. Tailwind Implementation Patterns

### Board Layout

```html
<!-- Board container -->
<div class="flex gap-6 p-6 h-[calc(100vh-64px)] overflow-x-auto">
  <!-- Column -->
  <div class="flex-shrink-0 w-80 flex flex-col bg-gray-100 rounded-xl">
    <!-- Column header (sticky) -->
    <div class="sticky top-0 z-10 flex items-center justify-between p-3 bg-gray-100 rounded-t-xl">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-blue-500"></span>
        <h2 class="font-semibold text-sm text-gray-700">In Progress</h2>
        <span class="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">3</span>
      </div>
      <button class="text-gray-400 hover:text-gray-600">
        <!-- Plus icon -->
      </button>
    </div>
    <!-- Card list -->
    <div class="flex-1 overflow-y-auto p-2 space-y-2">
      <!-- Cards go here -->
    </div>
    <!-- Add card footer -->
    <div class="p-2">
      <button class="w-full text-left text-sm text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-200">
        + Add a card
      </button>
    </div>
  </div>
</div>
```

### Card Component

```html
<!-- Task card -->
<div class="bg-white rounded-lg p-3 shadow-sm border border-gray-200
            hover:shadow-md hover:border-gray-300
            cursor-grab active:cursor-grabbing
            transition-shadow duration-150">
  <!-- Title -->
  <h3 class="text-sm font-medium text-gray-800 line-clamp-2">
    Implement user authentication flow
  </h3>
  <!-- Description preview (if exists) -->
  <p class="mt-1 text-xs text-gray-500 line-clamp-1">
    Set up JWT tokens and session management...
  </p>
  <!-- Footer: assignee -->
  <div class="mt-2 flex items-center justify-end">
    <div class="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
      <span class="text-xs text-white font-medium">JD</span>
    </div>
  </div>
</div>
```

### Drag Overlay Card

```html
<!-- DragOverlay content -->
<div class="bg-white rounded-lg p-3 shadow-xl border border-blue-300
            rotate-2 scale-105 opacity-95">
  <!-- Same card content as above -->
</div>
```

### Placeholder (Dragging Original)

```html
<!-- Card being dragged (original position) -->
<div class="bg-gray-100 rounded-lg p-3 border-2 border-dashed border-gray-300
            opacity-40">
  <!-- Same card content, faded -->
</div>
```

### Empty Column State

```html
<div class="flex-1 flex items-center justify-center p-4">
  <div class="text-center py-8 px-4 border-2 border-dashed border-gray-300 rounded-lg w-full">
    <p class="text-sm text-gray-400">No tasks yet</p>
    <button class="mt-2 text-sm text-blue-500 hover:text-blue-600 font-medium">
      + Add a task
    </button>
  </div>
</div>
```

### Inline Create Form

```html
<div class="p-2">
  <div class="bg-white rounded-lg p-3 shadow-sm border border-blue-300">
    <textarea
      class="w-full text-sm text-gray-800 placeholder-gray-400 resize-none
             border-none outline-none focus:ring-0"
      placeholder="Enter a title for this card..."
      rows="2"
      autofocus
    ></textarea>
    <div class="flex items-center gap-2 mt-2">
      <button class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md
                     hover:bg-blue-700 font-medium">
        Add Card
      </button>
      <button class="p-1.5 text-gray-400 hover:text-gray-600">
        <!-- X icon -->
      </button>
    </div>
  </div>
</div>
```

### Task Edit Modal

```html
<!-- Backdrop -->
<div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
  <!-- Modal -->
  <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg">
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b border-gray-200">
      <input
        class="text-lg font-semibold text-gray-800 border-none outline-none
               focus:ring-0 w-full"
        value="Task title here"
      />
      <button class="text-gray-400 hover:text-gray-600 ml-2">
        <!-- X icon -->
      </button>
    </div>
    <!-- Body -->
    <div class="p-4 space-y-4">
      <!-- Description -->
      <div>
        <label class="text-sm font-medium text-gray-600">Description</label>
        <textarea
          class="mt-1 w-full text-sm text-gray-700 border border-gray-300
                 rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500"
          rows="4"
          placeholder="Add a description..."
        ></textarea>
      </div>
      <!-- Assignee -->
      <div>
        <label class="text-sm font-medium text-gray-600">Assignee</label>
        <select class="mt-1 w-full text-sm border border-gray-300 rounded-lg
                       p-2.5 focus:ring-blue-500 focus:border-blue-500">
          <option value="">Unassigned</option>
          <option>John Doe</option>
        </select>
      </div>
    </div>
    <!-- Footer -->
    <div class="flex items-center justify-between p-4 border-t border-gray-200">
      <button class="text-sm text-red-600 hover:text-red-700 font-medium">
        Delete Task
      </button>
      <button class="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg
                     hover:bg-blue-700 font-medium">
        Save Changes
      </button>
    </div>
  </div>
</div>
```

### Color and Spacing Conventions

**Color palette (using Tailwind defaults):**

| Element | Color | Tailwind Class |
|---------|-------|----------------|
| Board background | Light gray | `bg-gray-50` or `bg-slate-100` |
| Column background | Slightly darker | `bg-gray-100` or `bg-slate-50` |
| Card background | White | `bg-white` |
| Primary text | Dark gray | `text-gray-800` or `text-slate-800` |
| Secondary text | Medium gray | `text-gray-500` |
| Muted text | Light gray | `text-gray-400` |
| Primary action | Blue | `bg-blue-600 hover:bg-blue-700` |
| Destructive action | Red | `text-red-600 hover:text-red-700` |
| Card border | Light gray | `border-gray-200` |
| Focus ring | Blue | `ring-blue-500` |
| To Do accent | Slate | `bg-slate-400` |
| In Progress accent | Blue | `bg-blue-500` |
| Done accent | Green | `bg-green-500` |

**Spacing scale:**

| Context | Spacing | Tailwind |
|---------|---------|----------|
| Board padding | 24px | `p-6` |
| Column gap | 24px | `gap-6` |
| Column internal padding | 8px | `p-2` |
| Card padding | 12px | `p-3` |
| Card gap | 8px | `space-y-2` or `gap-2` |
| Section spacing in modal | 16px | `space-y-4` |

### Loading States

**Skeleton loading for the board:**

```html
<!-- Skeleton column -->
<div class="flex-shrink-0 w-80 flex flex-col bg-gray-100 rounded-xl p-3">
  <!-- Skeleton header -->
  <div class="h-5 w-24 bg-gray-300 rounded animate-pulse mb-3"></div>
  <!-- Skeleton cards -->
  <div class="space-y-2">
    <div class="bg-white rounded-lg p-3 space-y-2">
      <div class="h-4 w-3/4 bg-gray-200 rounded animate-pulse"></div>
      <div class="h-3 w-1/2 bg-gray-200 rounded animate-pulse"></div>
    </div>
    <div class="bg-white rounded-lg p-3 space-y-2">
      <div class="h-4 w-2/3 bg-gray-200 rounded animate-pulse"></div>
    </div>
  </div>
</div>
```

Use Tailwind's built-in `animate-pulse` class for skeleton shimmer effects. No additional library needed.

**Error state for the board:**

If the initial task fetch fails, show a centered error message with a retry button:

```html
<div class="flex-1 flex items-center justify-center">
  <div class="text-center">
    <p class="text-gray-600">Failed to load tasks</p>
    <button class="mt-2 text-blue-600 hover:text-blue-700 font-medium text-sm">
      Try again
    </button>
  </div>
</div>
```

**Action error feedback:**

For failed create/update/delete operations, use a toast notification:
- Success: green-themed toast, auto-dismiss after 3 seconds
- Error: red-themed toast, persists until dismissed
- Position: bottom-right or top-right of the viewport
- A lightweight custom toast is sufficient; no need for react-toastify for this scope

---

## 7. Reference Examples and Inspiration

### Primary References

| Reference | What to Take From It | URL |
|-----------|---------------------|-----|
| **Trello** | Inline card creation, card layout, column structure, "Add a card" UX, overall board feel | https://trello.com |
| **Linear** | Minimal card design (no description on card), clean typography, color-coded status dots, keyboard shortcuts | https://linear.app/docs/board-layout |
| **react-dnd-kit-tailwind-shadcn-ui** | Complete open-source implementation using exact same stack (@dnd-kit + Tailwind + React), accessible, well-structured | https://github.com/Georgegriff/react-dnd-kit-tailwind-shadcn-ui |
| **hover.dev Kanban** | Animated board components for React + Tailwind, Framer Motion integration examples | https://www.hover.dev/components/boards |
| **Flowbite Kanban** | Tailwind CSS-only kanban board layout reference | https://flowbite.com/application-ui/demo/pages/kanban/ |
| **UX Patterns for Devs** | Comprehensive pattern documentation including accessibility, anatomy, and design tokens | https://uxpatterns.dev/patterns/data-display/kanban-board |

### Open-Source Implementations Worth Studying

1. **Georgegriff/react-dnd-kit-tailwind-shadcn-ui** -- The closest match to our tech stack. React + @dnd-kit + Tailwind + shadcn/ui. Accessible, keyboard-navigable, well-documented. This should be the primary code reference.

2. **ClaytonDewey/kanban-board** -- React + TypeScript + Tailwind + dnd-kit. Another clean implementation specifically for kanban.

3. **barishazar3431/react-kanban-board** -- React + TypeScript + Tailwind + dnd-kit. Similar stack, good for comparing approaches.

4. **Tailwind Kanban Gist** -- A minimal Tailwind-only layout reference showing pure CSS/HTML structure without JavaScript complexity.

### Design Inspiration

- **Dribbble kanban-board tag** -- Browse for visual inspiration on card designs, color palettes, and animations: https://dribbble.com/tags/kanban-board
- **Figma Kanban Board UI Kits** -- Free community files for studying layout proportions and spacing
- **Mobbin (Linear screens)** -- Real screenshots of Linear's board view for studying their minimal card approach: https://mobbin.com

---

## Recommendation

For this project (React + Tailwind + @dnd-kit, simple task model with 3 fixed columns), the recommended UX approach is:

1. **Layout:** Horizontal flex container with three fixed-width (w-80 / 320px) columns on a gray-50 background. Columns have rounded corners and a slightly darker gray-100 background.

2. **Cards:** Compact white cards with shadow-sm, showing title (bold, 2-line clamp), 1-line description preview (muted), and assignee initials avatar (bottom-right). Hover state with shadow-md.

3. **Creation:** Trello-style inline form at the bottom of each column. Title-only input, auto-focused, Enter to submit. No modal for creation.

4. **Editing:** Click card to open a centered modal with title, description textarea, and assignee dropdown. Delete button in modal footer with simple confirmation dialog.

5. **Drag feedback:** DragOverlay with shadow-xl and rotate-2 for the ghost card. Original position shows opacity-30 placeholder. Target column gets a subtle highlight. Drop animation with ease-in-out.

6. **Empty states:** Dashed border container with "No tasks yet" message and "+ Add a task" link.

7. **Loading:** Skeleton cards with animate-pulse in each column during initial fetch.

8. **Errors:** Toast notifications for action failures. Centered retry message for initial load failures.

## Trade-offs

| Choice | Benefit | Cost |
|--------|---------|------|
| Inline creation over modal | Faster task creation, lower friction | Limited to title-only on create; users must edit to add description/assignee |
| Modal editing over inline editing | Clean card face, focused editing environment | Extra click to edit; interrupts board scanning |
| Fixed column width over flexible | Consistent, predictable layout | Wastes some space on very wide screens (acceptable for 3 columns) |
| Simple delete confirmation over undo-toast | Simpler implementation, no soft-delete needed | Slightly more friction than an undo pattern |
| Full card as drag handle over grip icon | Simpler implementation, larger touch target | No visual affordance that card is draggable (mitigated by cursor-grab) |
| DragOverlay with rotation over plain clone | More polished "picked up" feel | Slightly more visual complexity |

## Open Questions

1. **Should the inline create form persist after adding a card?** Trello keeps it open for rapid creation. This is nice UX but requires state management for the open/close toggle per column.

2. **Should we show the column selector in the edit modal?** The PRD says drag-and-drop handles column movement, but a dropdown in the edit modal would provide an alternative path. Recommendation: include it for accessibility (not everyone can drag).

3. **Optimistic updates vs. wait-for-server on drag?** The card should move immediately (optimistic) and revert on error. This is important for perceived performance but adds rollback complexity.

4. **Assignee avatar: initials or generic icon for unassigned?** Recommendation: Show initials for assigned cards, show nothing (no avatar element) for unassigned. Keeps unassigned cards even more compact.

5. **Should we add a manual refresh button?** The PRD mentions manual refresh (reload page or click refresh button). A small refresh icon in the board header would be helpful since users won't know to reload for others' changes.

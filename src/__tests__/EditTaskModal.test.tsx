// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import EditTaskModal from "../components/EditTaskModal";

// ---------------------------------------------------------------------------
// Types for test data
// ---------------------------------------------------------------------------
interface Task {
  id: number;
  title: string;
  description: string | null;
  column: "todo" | "in_progress" | "done";
  position: number;
  assignee_id: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTask(
  overrides: Partial<Task> & { id: number; title: string },
): Task {
  return {
    description: null,
    column: "todo",
    position: 1000,
    assignee_id: null,
    created_by: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const defaultUsers = [
  { id: 1, email: "alice@test.com", name: "Alice" },
  { id: 2, email: "bob@test.com", name: "Bob" },
  { id: 3, email: "charlie@test.com", name: "Charlie" },
];

function renderModal(
  taskOverrides: Partial<Task> = {},
  props: Record<string, unknown> = {},
) {
  const task = makeTask({
    id: 1,
    title: "Test task",
    description: "Test description",
    ...taskOverrides,
  });
  const defaultProps = {
    task,
    users: defaultUsers,
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    ...props,
  };
  const result = render(<EditTaskModal {...defaultProps} />);
  return { ...result, ...defaultProps };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
});

describe("EditTaskModal", () => {
  it("renders with task title pre-filled in an input", () => {
    renderModal({ title: "Fix login bug" });

    const titleInput = screen.getByDisplayValue("Fix login bug");
    expect(titleInput).toBeInTheDocument();
  });

  it("renders with task description pre-filled in a textarea", () => {
    renderModal({ description: "Users cannot log in after password reset" });

    const descriptionTextarea = screen.getByDisplayValue(
      "Users cannot log in after password reset",
    );
    expect(descriptionTextarea).toBeInTheDocument();
    expect(descriptionTextarea.tagName.toLowerCase()).toBe("textarea");
  });

  it("shows all users in the assignee dropdown", () => {
    renderModal();

    // Look for a select element or listbox containing all user names
    const assigneeSelect =
      screen.getByRole("combobox", { name: /assignee/i }) ||
      screen.getByLabelText(/assignee/i);

    expect(assigneeSelect).toBeInTheDocument();

    // All users should appear as options
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("can change column from a dropdown", () => {
    renderModal({ column: "todo" });

    // Look for a select/combobox for column/status
    const columnSelect =
      screen.getByRole("combobox", { name: /column|status/i }) ||
      screen.getByLabelText(/column|status/i);

    expect(columnSelect).toBeInTheDocument();

    // The dropdown should have options for all three columns
    const options = screen.getAllByRole("option");
    const optionTexts = options.map((opt) => opt.textContent?.toLowerCase());

    expect(optionTexts).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/to\s*do/i),
        expect.stringMatching(/in\s*progress/i),
        expect.stringMatching(/done/i),
      ]),
    );
  });

  it("save button calls onSave with task id and changed fields", async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal({ id: 42, title: "Original title" });

    // Edit the title
    const titleInput = screen.getByDisplayValue("Original title");
    await user.clear(titleInput);
    await user.type(titleInput, "Updated title");

    // Click save
    const saveButton = screen.getByRole("button", { name: /save/i });
    await user.click(saveButton);

    expect(onSave).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ title: "Updated title" }),
    );
  });

  it("delete button shows confirmation before calling onDelete", async () => {
    const user = userEvent.setup();
    const { onDelete, onClose } = renderModal({ id: 10 });

    // Click delete
    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await user.click(deleteButton);

    // A confirmation prompt should appear
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();

    // Confirm the deletion
    const confirmButton = screen.getByRole("button", {
      name: /confirm|yes|ok/i,
    });
    await user.click(confirmButton);

    expect(onDelete).toHaveBeenCalledWith(10);
    expect(onClose).toHaveBeenCalled();
  });

  it("clicking overlay or X button calls onClose without calling onSave", async () => {
    const user = userEvent.setup();
    const { onClose, onSave } = renderModal();

    // Look for a close button (X) or overlay
    const closeButton =
      screen.getByRole("button", { name: /close|x|\u00d7/i }) ||
      screen.getByLabelText(/close/i);

    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("can edit title and description", async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal({
      id: 5,
      title: "Old title",
      description: "Old description",
    });

    // Edit title
    const titleInput = screen.getByDisplayValue("Old title");
    await user.clear(titleInput);
    await user.type(titleInput, "New title");

    // Edit description
    const descTextarea = screen.getByDisplayValue("Old description");
    await user.clear(descTextarea);
    await user.type(descTextarea, "New description");

    // Save
    const saveButton = screen.getByRole("button", { name: /save/i });
    await user.click(saveButton);

    expect(onSave).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        title: "New title",
        description: "New description",
      }),
    );
  });
});

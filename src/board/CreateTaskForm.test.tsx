// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CreateTaskForm from "./CreateTaskForm";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
});

describe("CreateTaskForm", () => {
  it('shows "+ Add a card" button initially', () => {
    render(<CreateTaskForm column="todo" onSubmit={vi.fn()} />);

    expect(screen.getByText(/add a card/i)).toBeInTheDocument();
  });

  it("clicking the button shows a title input", async () => {
    const user = userEvent.setup();

    render(<CreateTaskForm column="todo" onSubmit={vi.fn()} />);

    await user.click(screen.getByText(/add a card/i));

    // An input for the task title should now be visible
    const input =
      screen.getByRole("textbox") || screen.getByPlaceholderText(/title|task/i);
    expect(input).toBeInTheDocument();
  });

  it("typing and pressing Enter submits with title and column", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<CreateTaskForm column="in_progress" onSubmit={onSubmit} />);

    // Open the form
    await user.click(screen.getByText(/add a card/i));

    // Type a title and press Enter
    const input = screen.getByRole("textbox");
    await user.type(input, "New task title{Enter}");

    expect(onSubmit).toHaveBeenCalledWith({
      title: "New task title",
      column: "in_progress",
    });
  });

  it("pressing Escape cancels and hides the input", async () => {
    const user = userEvent.setup();

    render(<CreateTaskForm column="todo" onSubmit={vi.fn()} />);

    // Open the form
    await user.click(screen.getByText(/add a card/i));

    // The input should be visible
    expect(screen.getByRole("textbox")).toBeInTheDocument();

    // Press Escape to cancel
    await user.keyboard("{Escape}");

    // Input should be gone, button should be back
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText(/add a card/i)).toBeInTheDocument();
  });

  it("form closes after submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<CreateTaskForm column="todo" onSubmit={onSubmit} />);

    // Open the form
    await user.click(screen.getByText(/add a card/i));

    // Type and submit
    const input = screen.getByRole("textbox");
    await user.type(input, "First task{Enter}");

    expect(onSubmit).toHaveBeenCalledWith({
      title: "First task",
      column: "todo",
    });

    // Form should close, showing the button again
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText(/add a card/i)).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Toast from "../components/Toast";

// ---------------------------------------------------------------------------
// Types for test data
// ---------------------------------------------------------------------------
interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "error";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeToast(
  overrides: Partial<ToastMessage> & { id: string; message: string },
): ToastMessage {
  return {
    type: "success",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Toast", () => {
  it("renders message text for each toast", () => {
    const toasts: ToastMessage[] = [
      makeToast({ id: "1", message: "Task created successfully" }),
    ];

    render(<Toast toasts={toasts} onDismiss={vi.fn()} />);

    expect(screen.getByText("Task created successfully")).toBeInTheDocument();
  });

  it("success toast auto-dismisses after 3 seconds", async () => {
    const onDismiss = vi.fn();
    const toasts: ToastMessage[] = [
      makeToast({ id: "success-1", message: "Saved!", type: "success" }),
    ];

    render(<Toast toasts={toasts} onDismiss={onDismiss} />);

    // Should not be dismissed yet
    expect(onDismiss).not.toHaveBeenCalled();

    // Advance past auto-dismiss threshold
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(onDismiss).toHaveBeenCalledWith("success-1");
  });

  it("error toast does NOT auto-dismiss after 3 seconds", async () => {
    const onDismiss = vi.fn();
    const toasts: ToastMessage[] = [
      makeToast({
        id: "error-1",
        message: "Something went wrong",
        type: "error",
      }),
    ];

    render(<Toast toasts={toasts} onDismiss={onDismiss} />);

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    // Error toasts should persist — onDismiss should NOT have been called
    expect(onDismiss).not.toHaveBeenCalled();

    // The error message should still be visible
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("clicking dismiss button calls onDismiss with the toast id", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onDismiss = vi.fn();
    const toasts: ToastMessage[] = [
      makeToast({ id: "dismiss-1", message: "Dismissable toast" }),
    ];

    render(<Toast toasts={toasts} onDismiss={onDismiss} />);

    // Find the dismiss/close button — could be an X button or a button with close/dismiss label
    const dismissButton = screen.getByRole("button", {
      name: /close|dismiss|x|\u00d7/i,
    });
    await user.click(dismissButton);

    expect(onDismiss).toHaveBeenCalledWith("dismiss-1");
  });

  it("multiple toasts stack and render all messages", () => {
    const toasts: ToastMessage[] = [
      makeToast({ id: "1", message: "First notification" }),
      makeToast({ id: "2", message: "Second notification", type: "error" }),
      makeToast({ id: "3", message: "Third notification" }),
    ];

    render(<Toast toasts={toasts} onDismiss={vi.fn()} />);

    expect(screen.getByText("First notification")).toBeInTheDocument();
    expect(screen.getByText("Second notification")).toBeInTheDocument();
    expect(screen.getByText("Third notification")).toBeInTheDocument();
  });
});

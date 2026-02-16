// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginForm from "../components/LoginForm";
import RegisterForm from "../components/RegisterForm";

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// LoginForm
// ---------------------------------------------------------------------------
describe("LoginForm", () => {
  it("renders email and password inputs and a submit button", () => {
    render(<LoginForm onLogin={vi.fn()} onSwitchToRegister={vi.fn()} />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /log\s*in|sign\s*in|submit/i }),
    ).toBeInTheDocument();
  });

  it("calls onLogin with email and password on submit", async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn().mockResolvedValue(undefined);

    render(<LoginForm onLogin={onLogin} onSwitchToRegister={vi.fn()} />);

    await user.type(screen.getByLabelText(/email/i), "alice@test.com");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(
      screen.getByRole("button", { name: /log\s*in|sign\s*in|submit/i }),
    );

    expect(onLogin).toHaveBeenCalledWith("alice@test.com", "secret123");
  });

  it("shows error message on login failure", async () => {
    const user = userEvent.setup();
    const onLogin = vi
      .fn()
      .mockRejectedValue(new Error("Invalid email or password"));

    render(<LoginForm onLogin={onLogin} onSwitchToRegister={vi.fn()} />);

    await user.type(screen.getByLabelText(/email/i), "alice@test.com");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(
      screen.getByRole("button", { name: /log\s*in|sign\s*in|submit/i }),
    );

    expect(
      await screen.findByText(/invalid email or password/i),
    ).toBeInTheDocument();
  });

  it("has a link or button to switch to register mode", () => {
    const onSwitchToRegister = vi.fn();

    render(
      <LoginForm onLogin={vi.fn()} onSwitchToRegister={onSwitchToRegister} />,
    );

    const switchElement = screen.getByRole("button", {
      name: /register|sign\s*up|create account/i,
    });
    expect(switchElement).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// RegisterForm
// ---------------------------------------------------------------------------
describe("RegisterForm", () => {
  it("renders email, name, and password inputs", () => {
    render(<RegisterForm onRegister={vi.fn()} onSwitchToLogin={vi.fn()} />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("calls onRegister with email, name, and password on submit", async () => {
    const user = userEvent.setup();
    const onRegister = vi.fn().mockResolvedValue(undefined);

    render(<RegisterForm onRegister={onRegister} onSwitchToLogin={vi.fn()} />);

    await user.type(screen.getByLabelText(/email/i), "bob@test.com");
    await user.type(screen.getByLabelText(/name/i), "Bob");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(
      screen.getByRole("button", {
        name: /register|sign\s*up|create account|submit/i,
      }),
    );

    expect(onRegister).toHaveBeenCalledWith("bob@test.com", "Bob", "secret123");
  });

  it("shows error message on registration failure", async () => {
    const user = userEvent.setup();
    const onRegister = vi
      .fn()
      .mockRejectedValue(new Error("Email already registered"));

    render(<RegisterForm onRegister={onRegister} onSwitchToLogin={vi.fn()} />);

    await user.type(screen.getByLabelText(/email/i), "bob@test.com");
    await user.type(screen.getByLabelText(/name/i), "Bob");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(
      screen.getByRole("button", {
        name: /register|sign\s*up|create account|submit/i,
      }),
    );

    expect(
      await screen.findByText(/email already registered/i),
    ).toBeInTheDocument();
  });
});

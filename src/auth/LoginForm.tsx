import { useState, type FormEvent } from "react";
import FormField, { inputClassName } from "../ui/FormField";
import Button from "../ui/Button";

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onSwitchToRegister: () => void;
}

export default function LoginForm({
  onLogin,
  onSwitchToRegister,
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await onLogin(email, password);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Email" htmlFor="login-email">
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClassName}
        />
      </FormField>
      <FormField label="Password" htmlFor="login-password">
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClassName}
        />
      </FormField>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full">
        Log in
      </Button>
      <Button type="button" variant="ghost" onClick={onSwitchToRegister}>
        Create account
      </Button>
    </form>
  );
}

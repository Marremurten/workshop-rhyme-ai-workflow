import { useState, type FormEvent } from "react";
import FormField, { inputClassName } from "./ui/FormField";
import Button from "./ui/Button";

interface RegisterFormProps {
  onRegister: (email: string, name: string, password: string) => Promise<void>;
  onSwitchToLogin: () => void;
}

export default function RegisterForm({
  onRegister,
  onSwitchToLogin,
}: RegisterFormProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await onRegister(email, name, password);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Email" htmlFor="register-email">
        <input
          id="register-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClassName}
        />
      </FormField>
      <FormField label="Name" htmlFor="register-name">
        <input
          id="register-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClassName}
        />
      </FormField>
      <FormField label="Password" htmlFor="register-password">
        <input
          id="register-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClassName}
        />
      </FormField>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full">
        Register
      </Button>
      <Button type="button" variant="ghost" onClick={onSwitchToLogin}>
        Sign in
      </Button>
    </form>
  );
}

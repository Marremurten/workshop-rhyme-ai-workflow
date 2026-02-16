import { useState, type FormEvent } from 'react';

interface RegisterFormProps {
  onRegister: (email: string, name: string, password: string) => Promise<void>;
  onSwitchToLogin: () => void;
}

export default function RegisterForm({ onRegister, onSwitchToLogin }: RegisterFormProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await onRegister(email, name, password);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="register-email" className="block text-sm font-medium text-gray-300">
          Email
        </label>
        <input
          id="register-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white"
        />
      </div>
      <div>
        <label htmlFor="register-name" className="block text-sm font-medium text-gray-300">
          Name
        </label>
        <input
          id="register-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white"
        />
      </div>
      <div>
        <label htmlFor="register-password" className="block text-sm font-medium text-gray-300">
          Password
        </label>
        <input
          id="register-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Register
      </button>
      <button
        type="button"
        onClick={onSwitchToLogin}
        className="w-full text-sm text-blue-600 hover:underline"
      >
        Sign in
      </button>
    </form>
  );
}

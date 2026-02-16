import { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';

function AuthGate() {
  const { user, loading, login, logout, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm rounded bg-white p-6 shadow">
          <h1 className="mb-6 text-center text-xl font-semibold">Kanban Board</h1>
          {mode === 'login' ? (
            <LoginForm onLogin={login} onSwitchToRegister={() => setMode('register')} />
          ) : (
            <RegisterForm onRegister={register} onSwitchToLogin={() => setMode('login')} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="flex items-center justify-between bg-white px-4 py-3 shadow">
        <h1 className="text-lg font-semibold">Kanban Board</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{user.name}</span>
          <button
            onClick={logout}
            className="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300"
          >
            Logout
          </button>
        </div>
      </header>
      <div data-testid="board-placeholder" className="p-4">
        Board
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

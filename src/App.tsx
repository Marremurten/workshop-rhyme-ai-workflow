import { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import Board from './components/Board';

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
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="w-full max-w-sm rounded bg-gray-900 p-6 shadow">
          <h1 className="mb-6 text-center text-xl font-semibold text-white">Kanban Board</h1>
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
    <div className="min-h-screen bg-gray-950">
      <Board userName={user.name} onLogout={logout} />
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

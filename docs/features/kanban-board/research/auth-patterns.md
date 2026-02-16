# JWT Authentication Patterns: Express.js + React (Vite)

## Summary

For this small kanban board app, the recommended approach is **JWT stored in an httpOnly cookie** with `SameSite=lax` and `Secure` (in production). This avoids exposing the token to JavaScript (preventing XSS theft), eliminates the need for manual token attachment on every request, and keeps the implementation simple. No refresh tokens are needed -- a single access token with a 7-day expiry in a cookie provides the right balance of simplicity and security for this use case.

---

## 1. Recommended Approach (with Rationale)

**Store the JWT in an httpOnly cookie set by the Express server.**

### Why not localStorage?

| Concern | localStorage | httpOnly Cookie |
|---------|-------------|-----------------|
| XSS token theft | Vulnerable -- any injected JS can read `localStorage` | Protected -- JS cannot access httpOnly cookies |
| CSRF | Not vulnerable (token must be manually attached) | Mitigated with `SameSite=lax` + `Content-Type: application/json` |
| Simplicity | Must manually attach `Authorization` header on every request | Browser sends cookie automatically |
| Logout | Must manually clear from storage | Server clears via `res.clearCookie()` |
| SSR compatibility | No (client-only) | Yes (not relevant here, but a bonus) |

OWASP recommends against storing session identifiers in localStorage because "the data is always accessible by JavaScript." Cookies with the httpOnly flag mitigate this risk.

The CSRF risk with cookies is handled by:
1. `SameSite=lax` -- prevents the cookie from being sent on cross-origin POST requests
2. Requiring `Content-Type: application/json` -- browsers cannot send JSON content-type from plain HTML forms or image tags, blocking most CSRF vectors

This matches what the existing sister project (`claudeteams`) already uses successfully with session cookies.

### Why no refresh tokens?

The PRD says "simple" and this is a small shared kanban board. A single JWT with 7-day expiry is sufficient. Refresh tokens add complexity (token rotation, revocation storage, silent refresh logic) that is unnecessary here. If the token expires, the user logs in again.

---

## 2. Backend Patterns

### 2.1 Dependencies

```
npm install jsonwebtoken bcrypt cookie-parser
npm install -D @types/jsonwebtoken @types/bcrypt @types/cookie-parser
```

### 2.2 bcrypt Password Hashing

Use **10 salt rounds** -- good balance of security and performance (~10 hashes/sec on a 2GHz core). bcrypt automatically generates and embeds the salt in the hash string, so no separate salt storage is needed.

```typescript
// server/auth.ts
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

**Key points:**
- Always use the **async** API (`bcrypt.hash`, `bcrypt.compare`) -- the sync versions block the event loop
- `bcrypt.compare` is timing-safe, preventing timing attacks
- Never store plaintext passwords; never log password values

### 2.3 JWT Token Generation and Cookie Setting

```typescript
// server/auth.ts (continued)
import jwt from 'jsonwebtoken';
import { Response } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const TOKEN_EXPIRY = '7d';
const COOKIE_NAME = 'token';

interface TokenPayload {
  userId: number;
  email: string;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function setTokenCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,                                    // JS cannot read it
    secure: process.env.NODE_ENV === 'production',     // HTTPS only in prod
    sameSite: 'lax',                                   // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000,                  // 7 days in ms
    path: '/',                                         // available on all routes
  });
}

export function clearTokenCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}
```

**Key points:**
- `secure: true` in production ensures the cookie is only sent over HTTPS
- `sameSite: 'lax'` allows the cookie to be sent on top-level navigations (GET) but blocks it on cross-site POST/PUT/DELETE
- `clearCookie` must pass the same options (except `maxAge`) as when the cookie was set, or the browser will not remove it

### 2.4 Auth Middleware (Protecting Routes)

```typescript
// server/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const COOKIE_NAME = 'token';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        email: string;
      };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies[COOKIE_NAME];

  if (!token) {
    res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
    return;
  }
}
```

**Key points:**
- Extract token from `req.cookies` (not from `Authorization` header) since we use httpOnly cookies
- `jwt.verify` throws if the token is expired, tampered with, or invalid
- Attach decoded payload to `req.user` for downstream route handlers
- Return early with `void` return type -- do not call `next()` after sending a response

### 2.5 Auth Routes (Register, Login, Logout, Me)

```typescript
// server/routes/auth.ts
import { Router, Request, Response } from 'express';
import { hashPassword, verifyPassword, generateToken, setTokenCookie, clearTokenCookie } from '../auth';
import { requireAuth } from '../middleware/auth';
import db from '../../db/schema'; // your DB access

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { email, name, password } = req.body;

  // Validate input
  if (!email || !name || !password) {
    return res.status(400).json({ error: 'Email, name, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  // Check for existing user
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Email already registered', code: 'CONFLICT' });
  }

  // Hash password and create user
  const passwordHash = await hashPassword(password);
  const result = db.prepare(
    'INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)'
  ).run(email, name, passwordHash, new Date().toISOString());

  const userId = result.lastInsertRowid as number;

  // Generate token and set cookie
  const token = generateToken({ userId, email });
  setTokenCookie(res, token);

  res.status(201).json({ id: userId, email, name });
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken({ userId: user.id, email: user.email });
  setTokenCookie(res, token);

  res.json({ id: user.id, email: user.email, name: user.name });
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  clearTokenCookie(res);
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: Request, res: Response) => {
  const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.user!.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

export default router;
```

**Key points:**
- Return the same error message for wrong email and wrong password ("Invalid email or password") to prevent user enumeration
- Auto-login after registration (set cookie immediately)
- `/me` endpoint uses `requireAuth` middleware -- used by frontend to check if the user is still authenticated on page load
- Never return `password_hash` in any response

### 2.6 Express App Setup (Middleware Stack)

```typescript
// server/index.ts
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import userRoutes from './routes/users';
import { requireAuth } from './middleware/auth';

const app = express();

// Parse JSON bodies and cookies
app.use(express.json());
app.use(cookieParser());

// Public routes (no auth required)
app.use('/api/auth', authRoutes);

// Protected routes (auth required)
app.use('/api/tasks', requireAuth, taskRoutes);
app.use('/api/users', requireAuth, userRoutes);

app.listen(3001, () => {
  console.log('Server running on port 3001');
});
```

**Key points:**
- `cookieParser()` is required to populate `req.cookies`
- Apply `requireAuth` at the router level for all protected routes, rather than on each individual handler
- Auth routes are public (login/register must be accessible without a token)

---

## 3. Frontend Patterns

### 3.1 API Client (Fetch Wrapper)

Since the JWT is in an httpOnly cookie, the browser sends it automatically. The frontend does not need to read, store, or attach the token manually. The only requirement is `credentials: 'include'` on fetch calls.

```typescript
// src/api/client.ts
const API_BASE = '/api'; // proxied by Vite in dev

interface ApiError {
  error: string;
  code?: string;
}

class ApiClient {
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',  // send cookies with every request
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid -- trigger logout in UI
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
      const errorBody: ApiError = await response.json().catch(() => ({
        error: 'An unexpected error occurred',
      }));
      throw new Error(errorBody.error);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
```

**Key points:**
- `credentials: 'include'` is essential -- without it, the browser will not send the httpOnly cookie
- `Content-Type: application/json` header provides additional CSRF protection (browsers cannot send this content type from HTML forms)
- Global 401 handling via a custom event allows the auth context to respond to expired tokens
- No need for axios -- the native fetch API is sufficient for this small app

### 3.2 Auth Context / Provider

```typescript
// src/contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '../api/client';

interface User {
  id: number;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // true until initial check completes

  // Check if user is already authenticated (cookie still valid)
  const checkAuth = useCallback(async () => {
    try {
      const userData = await api.get<User>('/auth/me');
      setUser(userData);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Listen for 401 events from the API client
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (email: string, password: string) => {
    const userData = await api.post<User>('/auth/login', { email, password });
    setUser(userData);
  };

  const register = async (email: string, name: string, password: string) => {
    const userData = await api.post<User>('/auth/register', { email, name, password });
    setUser(userData);
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

**Key points:**
- On initial load, call `GET /api/auth/me` to check if the existing cookie is still valid
- `loading` state prevents flash of login screen while the auth check is in progress
- The 401 event listener automatically logs the user out if the token expires mid-session
- Login and register set the user immediately from the response (no extra `/me` call needed)

### 3.3 Route Protection (Auth Gate)

Since the PRD specifies a simple app with no router library, use conditional rendering:

```typescript
// src/App.tsx
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Board } from './components/Board';
import { LoginPage } from './components/LoginPage';
import { LoadingSpinner } from './components/LoadingSpinner';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return <Board />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
```

**Key points:**
- No react-router needed for this simple case
- The `loading` state prevents a flash of the login page on refresh
- When `user` becomes `null` (after logout or 401), the login page renders automatically

### 3.4 Login / Register Form

```typescript
// src/components/LoginPage.tsx
import { useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (isRegister) {
        await register(email, name, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6">
          {isRegister ? 'Create Account' : 'Sign In'}
        </h1>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border rounded px-3 py-2 mb-3"
        />

        {isRegister && (
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border rounded px-3 py-2 mb-3"
          />
        )}

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="w-full border rounded px-3 py-2 mb-4"
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Loading...' : isRegister ? 'Register' : 'Sign In'}
        </button>

        <p className="text-center text-sm text-gray-500 mt-4">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            className="text-blue-600 hover:underline"
          >
            {isRegister ? 'Sign In' : 'Register'}
          </button>
        </p>
      </form>
    </div>
  );
}
```

### 3.5 Vite Proxy Configuration

The Vite dev server must proxy API requests to Express. This also makes cookies work seamlessly in development (same origin).

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

**Key point:** The Vite proxy makes `/api` requests appear same-origin to the browser, so `SameSite=lax` cookies work correctly in development without CORS configuration.

---

## 4. Security Considerations

### 4.1 XSS Protection

- **httpOnly cookie** prevents JavaScript from reading the token, so even if an XSS vulnerability exists, the attacker cannot exfiltrate the JWT
- Always sanitize user input rendered in the UI (React does this by default with JSX)
- Avoid rendering raw HTML from user-provided content

### 4.2 CSRF Protection

- **`SameSite=lax`** on the cookie blocks cross-site POST/PUT/DELETE/PATCH requests from sending the cookie
- **`Content-Type: application/json`** header acts as a secondary defense -- HTML forms and image tags cannot send this content type, and cross-origin fetch/XHR with non-simple content types trigger a CORS preflight that will be blocked
- No separate CSRF token library is needed for this simple app with these two protections in place

### 4.3 JWT Secret

- Use a strong, random secret (at least 32 characters) in production
- Store in environment variable, never commit to source code
- Use a different secret for each environment (dev, staging, prod)

```bash
# .env
JWT_SECRET=a-very-long-random-string-at-least-32-characters
```

### 4.4 Password Security

- bcrypt with 10 salt rounds
- Minimum 8 character password requirement
- Generic error messages on failed login ("Invalid email or password") to prevent user enumeration
- Never log or return password hashes

### 4.5 Rate Limiting (Recommended)

```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per window
  message: { error: 'Too many attempts, please try again later' },
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
```

### 4.6 Token Revocation Limitation

JWTs are stateless -- once issued, they cannot be revoked until they expire. For this simple app with 7-day expiry, this is an acceptable trade-off. If a user's account is compromised:
- They change their password (but the old token still works until expiry)
- For a more secure system, you would need a token blacklist in the database (out of scope for this app)

---

## 5. Gotchas and Tips

### 5.1 `clearCookie` Options Must Match

When calling `res.clearCookie()`, you must pass the **exact same options** (`httpOnly`, `secure`, `sameSite`, `path`) that were used when the cookie was set. If they do not match, the browser will not remove the cookie. This is a common source of bugs.

### 5.2 `credentials: 'include'` Is Required

Every fetch request to the API must include `credentials: 'include'`. Without it, the browser will not send the httpOnly cookie, and all requests will return 401. This is easy to forget when adding new API calls.

### 5.3 Async bcrypt in Express Routes

Express route handlers do not natively handle promise rejections. Use `async/await` with try/catch, or wrap handlers in an error-catching utility:

```typescript
// Utility to wrap async route handlers
function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// Usage
router.post('/register', asyncHandler(async (req, res) => {
  // ... async code with bcrypt
}));
```

In Express 5.x, async errors are automatically caught. If using Express 4.x (which is more common currently), wrap async handlers or use a library like `express-async-errors`.

### 5.4 Do Not Put Sensitive Data in the JWT Payload

The JWT payload is base64-encoded, not encrypted. Anyone can decode it. Only include non-sensitive identifiers (`userId`, `email`). Never include passwords, roles with elevated privileges, or other secrets.

### 5.5 Testing Auth in Development

- The Vite proxy makes cookies work seamlessly in dev (same origin)
- For API testing with tools like Postman or curl, you need to handle cookies explicitly:
  ```bash
  # Login and save cookie
  curl -c cookies.txt -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"password123"}'

  # Use saved cookie for authenticated requests
  curl -b cookies.txt http://localhost:3001/api/tasks
  ```

### 5.6 Initial Auth Check Timing

On page load, the frontend calls `GET /api/auth/me` to verify the cookie. Show a loading spinner during this check to avoid a flash of the login screen. Without this, users see the login form briefly on every page refresh before being redirected to the board.

### 5.7 Cookie Not Sent in Production Without HTTPS

If `secure: true` is set (as it should be in production), the cookie will only be sent over HTTPS connections. Running production without HTTPS will silently break authentication -- the cookie will be set but never sent back by the browser.

### 5.8 INTEGER vs TEXT Primary Keys

The PRD data model uses `INTEGER` primary keys. This is simpler than UUIDs for this small app. Make sure the JWT payload uses `userId: number` consistently (not string).

---

## Trade-offs

| Decision | Benefit | Cost |
|----------|---------|------|
| httpOnly cookie over localStorage | Immune to XSS token theft | Cannot decode JWT on client (need `/me` endpoint) |
| No refresh tokens | Simpler implementation, fewer endpoints | User must re-login after 7 days; no silent refresh |
| 7-day expiry | Users stay logged in for a week | If compromised, token is valid for up to 7 days |
| SameSite=lax over strict | Navigation to the app from external links works | Slightly less strict than `strict` (but `lax` blocks all non-GET cross-site requests) |
| fetch over axios | No extra dependency, built into browsers | No built-in interceptors (handled with wrapper class) |
| Context over Zustand/Redux | Built into React, no extra dependency | Less suitable for complex state (fine for auth) |

---

## Open Questions

1. **Should logout also invalidate the JWT server-side?** For this simple app, clearing the cookie is sufficient. But if a user logs out on one device, the token could still be used on another device until it expires. A server-side token blacklist would prevent this but adds database complexity.

2. **Should we add email format validation on the backend beyond just "not empty"?** A simple regex check could prevent malformed emails from being stored. The HTML5 `type="email"` input handles this on the frontend but the backend should not trust client validation.

3. **Password strength requirements beyond length?** The PRD does not specify. Minimum 8 characters is reasonable. Adding complexity requirements (uppercase, number, special char) improves security but hurts UX for a small app.

---

## Sources

- [JWT Storage in React: Local Storage vs Cookies Security Battle](https://cybersierra.co/blog/react-jwt-storage-guide/)
- [Ultimate Guide to Securing JWT Authentication with httpOnly Cookies](https://www.wisp.blog/blog/ultimate-guide-to-securing-jwt-authentication-with-httponly-cookies)
- [Client-side Authentication the Right Way (Cookies vs. Local Storage)](https://www.taniarascia.com/full-stack-cookies-localstorage-react-express/)
- [How To Use JSON Web Tokens (JWTs) in Express.js - DigitalOcean](https://www.digitalocean.com/community/tutorials/nodejs-jwt-expressjs)
- [bcrypt - npm](https://www.npmjs.com/package/bcrypt)
- [jsonwebtoken - npm](https://www.npmjs.com/package/jsonwebtoken)
- [OWASP Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP JWT Security Best Practices](https://www.oreateai.com/blog/jwt-security-best-practices-owasp/cdbcfa4c4564c4873447e79be1e92858)
- [Express JWT Cookies Demo App](https://github.com/bartdorsey/express-jwt-cookies-demo-app)
- [Syncfusion: JWT Authentication in React](https://www.syncfusion.com/blogs/post/implement-jwt-authentication-in-react)
- [Auth and Context in React 18](https://www.sammeechward.com/use-context-auth?playlist=all-you-need-to-know-about-react-js)
- [The 2025 Cookiepocalypse: Implementing SameSite Strict in Node.js Auth Systems](https://markaicode.com/nodejs-samesite-strict-cookies-2025/)

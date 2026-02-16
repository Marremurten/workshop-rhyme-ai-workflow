import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type Database from "better-sqlite3";
import { createTestApp, registerAndGetCookie } from "./helpers";

describe("POST /api/auth/register", () => {
  let app: Express;
  let db: Database.Database;

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  it("returns 201 with user object and sets auth cookie", async () => {
    ({ app, db } = createTestApp());

    const res = await request(app).post("/api/auth/register").send({
      email: "alice@example.com",
      name: "Alice",
      password: "password123",
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.id).toEqual(expect.any(Number));
    expect(res.body.user.email).toBe("alice@example.com");
    expect(res.body.user.name).toBe("Alice");
    // Must not return password_hash
    expect(res.body.user).not.toHaveProperty("password_hash");

    // Must set a token cookie
    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    const tokenCookie = cookies.find((c: string) => c.startsWith("token="));
    expect(tokenCookie).toBeDefined();
    // Cookie should be httpOnly
    expect(tokenCookie).toMatch(/httponly/i);
  });

  it("returns 409 when email is already registered", async () => {
    ({ app, db } = createTestApp());

    await request(app)
      .post("/api/auth/register")
      .send({
        email: "alice@example.com",
        name: "Alice",
        password: "password123",
      })
      .expect(201);

    const res = await request(app).post("/api/auth/register").send({
      email: "alice@example.com",
      name: "Alice Again",
      password: "other123",
    });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Email already registered" });
  });

  it("returns 400 when required fields are missing", async () => {
    ({ app, db } = createTestApp());

    // Missing all fields
    const res1 = await request(app).post("/api/auth/register").send({});
    expect(res1.status).toBe(400);
    expect(res1.body).toEqual({
      error: "Email, name, and password are required",
    });

    // Missing password
    const res2 = await request(app)
      .post("/api/auth/register")
      .send({ email: "alice@example.com", name: "Alice" });
    expect(res2.status).toBe(400);

    // Missing name
    const res3 = await request(app)
      .post("/api/auth/register")
      .send({ email: "alice@example.com", password: "password123" });
    expect(res3.status).toBe(400);

    // Missing email
    const res4 = await request(app)
      .post("/api/auth/register")
      .send({ name: "Alice", password: "password123" });
    expect(res4.status).toBe(400);
  });

  it("hashes the password (does not store plain text)", async () => {
    ({ app, db } = createTestApp());

    await request(app)
      .post("/api/auth/register")
      .send({
        email: "alice@example.com",
        name: "Alice",
        password: "password123",
      })
      .expect(201);

    const user = db
      .prepare("SELECT password_hash FROM users WHERE email = ?")
      .get("alice@example.com") as { password_hash: string } | undefined;

    expect(user).toBeDefined();
    // password_hash should not equal the plain text password
    expect(user!.password_hash).not.toBe("password123");
    // bcrypt hashes start with $2b$ (or $2a$)
    expect(user!.password_hash).toMatch(/^\$2[ab]\$/);
  });
});

describe("POST /api/auth/login", () => {
  let app: Express;
  let db: Database.Database;

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  it("returns 200 with user and sets auth cookie on valid credentials", async () => {
    ({ app, db } = createTestApp());

    // Register first
    await request(app)
      .post("/api/auth/register")
      .send({
        email: "alice@example.com",
        name: "Alice",
        password: "password123",
      })
      .expect(201);

    // Login
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe("alice@example.com");
    expect(res.body.user.name).toBe("Alice");
    expect(res.body.user.id).toEqual(expect.any(Number));
    expect(res.body.user).not.toHaveProperty("password_hash");

    // Must set a token cookie
    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    const tokenCookie = cookies.find((c: string) => c.startsWith("token="));
    expect(tokenCookie).toBeDefined();
  });

  it("returns 401 with generic message on wrong password", async () => {
    ({ app, db } = createTestApp());

    await request(app)
      .post("/api/auth/register")
      .send({
        email: "alice@example.com",
        name: "Alice",
        password: "password123",
      })
      .expect(201);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@example.com", password: "wrongpassword" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid email or password" });
  });

  it("returns 401 with generic message on nonexistent email", async () => {
    ({ app, db } = createTestApp());

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "password123" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid email or password" });
  });
});

describe("GET /api/auth/me", () => {
  let app: Express;
  let db: Database.Database;

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  it("returns 200 with user when valid auth cookie is present", async () => {
    ({ app, db } = createTestApp());

    const cookie = await registerAndGetCookie(app);

    const res = await request(app).get("/api/auth/me").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe("test@example.com");
    expect(res.body.user.name).toBe("Test User");
    expect(res.body.user.id).toEqual(expect.any(Number));
    expect(res.body.user).not.toHaveProperty("password_hash");
  });

  it("returns 401 without auth cookie", async () => {
    ({ app, db } = createTestApp());

    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });
});

describe("POST /api/auth/logout", () => {
  let app: Express;
  let db: Database.Database;

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  it("clears the auth cookie", async () => {
    ({ app, db } = createTestApp());

    const cookie = await registerAndGetCookie(app);

    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Logged out" });

    // The set-cookie header should clear the token
    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    const tokenCookie = cookies.find((c: string) => c.startsWith("token="));
    expect(tokenCookie).toBeDefined();
    // A cleared cookie has an empty value or expires in the past
    expect(tokenCookie).toMatch(/token=;|token=$/);
  });
});

describe("GET /api/users", () => {
  let app: Express;
  let db: Database.Database;

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  it("returns all registered users (id, email, name) without password_hash", async () => {
    ({ app, db } = createTestApp());

    // Register two users
    const cookie = await registerAndGetCookie(app);

    await request(app)
      .post("/api/auth/register")
      .send({ email: "bob@example.com", name: "Bob", password: "password456" })
      .expect(201);

    const res = await request(app).get("/api/users").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.users).toBeDefined();
    expect(res.body.users).toHaveLength(2);

    for (const user of res.body.users) {
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("email");
      expect(user).toHaveProperty("name");
      expect(user).not.toHaveProperty("password_hash");
    }

    const emails = res.body.users.map((u: { email: string }) => u.email);
    expect(emails).toContain("test@example.com");
    expect(emails).toContain("bob@example.com");
  });

  it("returns 401 without auth cookie", async () => {
    ({ app, db } = createTestApp());

    const res = await request(app).get("/api/users");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });
});

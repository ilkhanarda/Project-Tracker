import { zValidator } from "@hono/zod-validator";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { z } from "zod";

import { db } from "../db/index.js";
import { usersTable } from "../db/schema.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import {
  createSession,
  deleteSession,
  getBearerToken,
  getUserBySessionToken,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  type AppEnv,
  type AuthUser,
} from "../lib/session.js";

const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address")
  .max(254, "Email is too long");

const passwordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters")
  .max(128, "Password is too long");

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z
    .string()
    .trim()
    .min(2, "Display name must contain at least 2 characters")
    .max(50, "Display name is too long"),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
});

const auth = new Hono<AppEnv>();

function setSessionCookie(c: Context, token: string, expiresAt: Date) {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
    expires: expiresAt,
  });
}

function publicUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
  };
}

function getRequestSessionToken(c: Context) {
  return (
    getCookie(c, SESSION_COOKIE_NAME) ??
    getBearerToken(c.req.header("Authorization"))
  );
}

async function findUserWithPassword(email: string) {
  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      displayName: usersTable.displayName,
      createdAt: usersTable.createdAt,
      passwordHash: usersTable.passwordHash,
    })
    .from(usersTable)
    .where(eq(sql`lower(${usersTable.email})`, email.toLowerCase()))
    .limit(1);

  return user;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

async function authenticate(email: string, password: string) {
  const user = await findUserWithPassword(email);

  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    return undefined;
  }

  return {
    user,
    session: await createSession(user.id),
  };
}

auth.post("/register", zValidator("json", registerSchema), async (c) => {
  const body = c.req.valid("json");
  const normalizedEmail = body.email.toLowerCase();

  const [existingUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(sql`lower(${usersTable.email})`, normalizedEmail))
    .limit(1);

  if (existingUser) {
    return c.json({ error: "Email is already registered" }, 409);
  }

  const passwordHash = await hashPassword(body.password);

  try {
    const [user] = await db
      .insert(usersTable)
      .values({
        email: normalizedEmail,
        passwordHash,
        displayName: body.displayName,
      })
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
        createdAt: usersTable.createdAt,
      });

    if (!user) {
      throw new Error("User could not be created");
    }

    const session = await createSession(user.id);
    setSessionCookie(c, session.token, session.expiresAt);

    return c.json({ user: publicUser(user) }, 201);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return c.json({ error: "Email is already registered" }, 409);
    }

    throw error;
  }
});

auth.post("/login", zValidator("json", loginSchema), async (c) => {
  const body = c.req.valid("json");
  const result = await authenticate(body.email, body.password);

  if (!result) {
    return c.json({ error: "Email or password is incorrect" }, 401);
  }

  setSessionCookie(c, result.session.token, result.session.expiresAt);

  return c.json({ user: publicUser(result.user) });
});

auth.post("/mobile/register", zValidator("json", registerSchema), async (c) => {
  const body = c.req.valid("json");
  const normalizedEmail = body.email.toLowerCase();

  const [existingUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(sql`lower(${usersTable.email})`, normalizedEmail))
    .limit(1);

  if (existingUser) {
    return c.json({ error: "Email is already registered" }, 409);
  }

  const passwordHash = await hashPassword(body.password);

  try {
    const [user] = await db
      .insert(usersTable)
      .values({
        email: normalizedEmail,
        passwordHash,
        displayName: body.displayName,
      })
      .returning({
        id: usersTable.id,
        email: usersTable.email,
        displayName: usersTable.displayName,
        createdAt: usersTable.createdAt,
      });

    if (!user) {
      throw new Error("User could not be created");
    }

    const session = await createSession(user.id);

    return c.json(
      {
        user: publicUser(user),
        session: {
          token: session.token,
          expiresAt: session.expiresAt,
        },
      },
      201,
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return c.json({ error: "Email is already registered" }, 409);
    }

    throw error;
  }
});

auth.post("/mobile/login", zValidator("json", loginSchema), async (c) => {
  const body = c.req.valid("json");
  const result = await authenticate(body.email, body.password);

  if (!result) {
    return c.json({ error: "Email or password is incorrect" }, 401);
  }

  return c.json({
    user: publicUser(result.user),
    session: {
      token: result.session.token,
      expiresAt: result.session.expiresAt,
    },
  });
});

auth.get("/me", async (c) => {
  const sessionToken = getRequestSessionToken(c);

  if (!sessionToken) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const user = await getUserBySessionToken(sessionToken);

  if (!user) {
    deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
    return c.json({ error: "Session is invalid or expired" }, 401);
  }

  return c.json({ user: publicUser(user) });
});

auth.post("/logout", async (c) => {
  const sessionToken = getRequestSessionToken(c);

  if (sessionToken) {
    await deleteSession(sessionToken);
  }

  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
  return c.json({ message: "Logged out successfully" });
});

export default auth;

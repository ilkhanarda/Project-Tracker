import { zValidator } from "@hono/zod-validator";
import { eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "../db/index.js";
import { usersTable } from "../db/schema.js";
import { hashPassword } from "../lib/password.js";

const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(254, "Email is too long"),

  password: z
    .string()
    .min(8, "Password must contain at least 8 characters")
    .max(128, "Password is too long"),

  displayName: z
    .string()
    .trim()
    .min(2, "Display name must contain at least 2 characters")
    .max(50, "Display name is too long"),
});

const auth = new Hono();

auth.post("/register", zValidator("json", registerSchema), async (c) => {
  const body = c.req.valid("json");
  const normalizedEmail = body.email.toLowerCase();

  const existingUser = db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(sql`lower(${usersTable.email})`, normalizedEmail))
    .get();

  if (existingUser) {
    return c.json({ error: "Email is already registered" }, 409);
  }

  const passwordHash = await hashPassword(body.password);

  try {
    const user = db
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
      })
      .get();

    return c.json(user, 201);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed")
    ) {
      return c.json({ error: "Email is already registered" }, 409);
    }

    throw error;
  }
});

export default auth;

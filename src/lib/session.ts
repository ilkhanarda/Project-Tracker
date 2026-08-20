import { createHash, randomBytes } from "node:crypto";
import { eq, lte } from "drizzle-orm";

import { db } from "../db/index.js";
import { sessionsTable, usersTable } from "../db/schema.js";

export const SESSION_COOKIE_NAME = "project_tracking_session";
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export type AuthUser = {
  id: number;
  email: string;
  displayName: string;
  createdAt: Date;
};

export type AppEnv = {
  Variables: {
    user: AuthUser;
    sessionToken: string;
  };
};

export function getBearerToken(authorizationHeader: string | undefined) {
  if (!authorizationHeader) return undefined;

  const [scheme, token, ...rest] = authorizationHeader.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== "bearer" || !token || rest.length > 0) {
    return undefined;
  }

  return token;
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

  await db
    .delete(sessionsTable)
    .where(lte(sessionsTable.expiresAt, new Date()));

  await db
    .insert(sessionsTable)
    .values({
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
    });

  return { token, expiresAt };
}

export async function getUserBySessionToken(
  token: string,
): Promise<AuthUser | undefined> {
  const [result] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      displayName: usersTable.displayName,
      createdAt: usersTable.createdAt,
      expiresAt: sessionsTable.expiresAt,
    })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(eq(sessionsTable.tokenHash, hashSessionToken(token)))
    .limit(1);

  if (!result) return undefined;

  if (result.expiresAt.getTime() <= Date.now()) {
    await deleteSession(token);
    return undefined;
  }

  return {
    id: result.id,
    email: result.email,
    displayName: result.displayName,
    createdAt: result.createdAt,
  };
}

export async function deleteSession(token: string) {
  await db
    .delete(sessionsTable)
    .where(eq(sessionsTable.tokenHash, hashSessionToken(token)));
}

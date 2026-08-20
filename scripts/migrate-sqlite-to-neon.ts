import "dotenv/config";

import { DatabaseSync } from "node:sqlite";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import {
  authTokensTable,
  projectsTable,
  sessionsTable,
  tasksTable,
  usersTable,
} from "../src/db/schema.js";

type SqliteUser = {
  id: number;
  email: string;
  password_hash: string;
  display_name: string;
  created_at: number;
  updated_at: number;
};

type SqliteSession = {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: number;
  created_at: number;
};

type SqliteProject = {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  created_at: number;
  updated_at: number;
};

type SqliteAuthToken = {
  id: number;
  user_id: number;
  token_hash: string;
  type: "email_verification" | "password_reset";
  expires_at: number;
  used_at: number | null;
  created_at: number;
};

type SqliteTask = {
  id: number;
  project_id: number;
  title: string;
  completed: number;
  created_at: number;
  updated_at: number;
};

const databaseUrl = process.env.DATABASE_URL;
const sqliteFile = process.env.DB_FILE_NAME;

if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!sqliteFile) throw new Error("DB_FILE_NAME is required");

const sqlite = new DatabaseSync(sqliteFile, { readOnly: true });
const sql = neon(databaseUrl);
const db = drizzle({ client: sql });

function unixDate(value: number) {
  return new Date(value * 1000);
}

function readRows<T>(query: string): T[] {
  try {
    return sqlite.prepare(query).all() as T[];
  } catch (error) {
    if (error instanceof Error && error.message.includes("no such table")) {
      return [];
    }
    throw error;
  }
}

async function migrate() {
  const users = readRows<SqliteUser>("SELECT * FROM users ORDER BY id");
  const sessions = readRows<SqliteSession>("SELECT * FROM sessions ORDER BY id");
  const projects = readRows<SqliteProject>("SELECT * FROM projects ORDER BY id");
  const authTokens = readRows<SqliteAuthToken>("SELECT * FROM auth_tokens ORDER BY id");
  const tasks = readRows<SqliteTask>("SELECT * FROM tasks ORDER BY id");

  if (users.length > 0) {
    await db.insert(usersTable).values(users.map((user) => ({
      id: user.id,
      email: user.email,
      passwordHash: user.password_hash,
      displayName: user.display_name,
      createdAt: unixDate(user.created_at),
      updatedAt: unixDate(user.updated_at),
    }))).onConflictDoNothing();
  }

  if (projects.length > 0) {
    await db.insert(projectsTable).values(projects.map((project) => ({
      id: project.id,
      userId: project.user_id,
      name: project.name,
      description: project.description,
      createdAt: unixDate(project.created_at),
      updatedAt: unixDate(project.updated_at),
    }))).onConflictDoNothing();
  }

  if (sessions.length > 0) {
    await db.insert(sessionsTable).values(sessions.map((session) => ({
      id: session.id,
      userId: session.user_id,
      tokenHash: session.token_hash,
      expiresAt: unixDate(session.expires_at),
      createdAt: unixDate(session.created_at),
    }))).onConflictDoNothing();
  }

  if (authTokens.length > 0) {
    await db.insert(authTokensTable).values(authTokens.map((token) => ({
      id: token.id,
      userId: token.user_id,
      tokenHash: token.token_hash,
      type: token.type,
      expiresAt: unixDate(token.expires_at),
      usedAt: token.used_at === null ? null : unixDate(token.used_at),
      createdAt: unixDate(token.created_at),
    }))).onConflictDoNothing();
  }

  if (tasks.length > 0) {
    await db.insert(tasksTable).values(tasks.map((task) => ({
      id: task.id,
      projectId: task.project_id,
      title: task.title,
      completed: Boolean(task.completed),
      createdAt: unixDate(task.created_at),
      updatedAt: unixDate(task.updated_at),
    }))).onConflictDoNothing();
  }

  await sql`SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM users`;
  await sql`SELECT setval(pg_get_serial_sequence('sessions', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM sessions`;
  await sql`SELECT setval(pg_get_serial_sequence('projects', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM projects`;
  await sql`SELECT setval(pg_get_serial_sequence('auth_tokens', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM auth_tokens`;
  await sql`SELECT setval(pg_get_serial_sequence('tasks', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM tasks`;

  console.info(
    `Migrated ${users.length} users, ${projects.length} projects, ${tasks.length} tasks, ` +
      `${sessions.length} sessions and ${authTokens.length} auth tokens.`,
  );
}

try {
  await migrate();
} finally {
  sqlite.close();
}

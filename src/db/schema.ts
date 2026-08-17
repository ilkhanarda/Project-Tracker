import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const usersTable = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    email: text("email").notNull(),

    passwordHash: text("password_hash").notNull(),

    displayName: text("display_name").notNull(),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),

    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("users_email_unique").on(sql`lower(${table.email})`),
  ],
);

export const sessionsTable = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, {
        onDelete: "cascade",
      }),

    tokenHash: text("token_hash").notNull(),

    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const projectsTable = sqliteTable(
  "projects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, {
        onDelete: "cascade",
      }),

    name: text("name").notNull(),

    description: text("description"),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),

    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (table) => [index("projects_user_id_idx").on(table.userId)],
);

export const authTokensTable = sqliteTable(
  "auth_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, {
        onDelete: "cascade",
      }),

    tokenHash: text("token_hash").notNull(),

    type: text("type", {
      enum: ["email_verification", "password_reset"],
    }).notNull(),

    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),

    usedAt: integer("used_at", { mode: "timestamp" }),
  },
  (table) => [
    uniqueIndex("auth_tokens_token_hash_unique").on(table.tokenHash),
    index("auth_tokens_user_id_idx").on(table.userId),
    index("auth_tokens_expires_at_idx").on(table.expiresAt),
  ],
);

export const tasksTable = sqliteTable(
  "tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),

    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, {
        onDelete: "cascade",
      }),

    title: text("title").notNull(),

    completed: integer("completed", { mode: "boolean" })
      .notNull()
      .default(false),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),

    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("tasks_project_id_idx").on(table.projectId),
    index("tasks_project_completed_idx").on(
      table.projectId,
      table.completed,
    ),
  ],
);

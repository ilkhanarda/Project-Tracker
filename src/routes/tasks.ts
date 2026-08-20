import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "../db/index.js";
import { projectsTable, tasksTable } from "../db/schema.js";
import type { AppEnv } from "../lib/session.js";
import { requireAuth } from "../middleware/auth.js";

const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  completed: z.boolean().optional(),
});

const updateTaskSchema = createTaskSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required",
  });

export const projectTasks = new Hono<AppEnv>();

function parsePositiveId(rawId: string) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function userOwnsProject(projectId: number, userId: number) {
  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(
      and(
        eq(projectsTable.id, projectId),
        eq(projectsTable.userId, userId),
      ),
    )
    .limit(1);

  return project;
}

projectTasks.use("*", requireAuth);

projectTasks.get("/:projectId/tasks", async (c) => {
  const projectId = parsePositiveId(c.req.param("projectId"));
  const user = c.get("user");

  if (projectId === null) {
    return c.json({ error: "Invalid project id" }, 400);
  }

  if (!(await userOwnsProject(projectId, user.id))) {
    return c.json({ error: "Project not found" }, 404);
  }

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.projectId, projectId));

  return c.json(tasks);
});

projectTasks.post(
  "/:projectId/tasks",
  zValidator("json", createTaskSchema),
  async (c) => {
    const projectId = parsePositiveId(c.req.param("projectId"));
    const body = c.req.valid("json");
    const user = c.get("user");

    if (projectId === null) {
      return c.json({ error: "Invalid project id" }, 400);
    }

    if (!(await userOwnsProject(projectId, user.id))) {
      return c.json({ error: "Project not found" }, 404);
    }

    const [task] = await db
      .insert(tasksTable)
      .values({
        title: body.title,
        completed: body.completed,
        projectId,
      })
      .returning();

    if (!task) {
      throw new Error("Task could not be created");
    }

    return c.json(task, 201);
  },
);

projectTasks.get("/:projectId/tasks/:taskId", async (c) => {
  const projectId = parsePositiveId(c.req.param("projectId"));
  const taskId = parsePositiveId(c.req.param("taskId"));
  const user = c.get("user");

  if (projectId === null || taskId === null) {
    return c.json({ error: "Invalid project or task id" }, 400);
  }

  if (!(await userOwnsProject(projectId, user.id))) {
    return c.json({ error: "Project not found" }, 404);
  }

  const [task] = await db
    .select()
    .from(tasksTable)
    .where(
      and(eq(tasksTable.id, taskId), eq(tasksTable.projectId, projectId)),
    )
    .limit(1);

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json(task);
});

projectTasks.patch(
  "/:projectId/tasks/:taskId",
  zValidator("json", updateTaskSchema),
  async (c) => {
    const projectId = parsePositiveId(c.req.param("projectId"));
    const taskId = parsePositiveId(c.req.param("taskId"));
    const body = c.req.valid("json");
    const user = c.get("user");

    if (projectId === null || taskId === null) {
      return c.json({ error: "Invalid project or task id" }, 400);
    }

    if (!(await userOwnsProject(projectId, user.id))) {
      return c.json({ error: "Project not found" }, 404);
    }

    const [updatedTask] = await db
      .update(tasksTable)
      .set(body)
      .where(
        and(eq(tasksTable.id, taskId), eq(tasksTable.projectId, projectId)),
      )
      .returning();

    if (!updatedTask) {
      return c.json({ error: "Task not found" }, 404);
    }

    return c.json(updatedTask);
  },
);

projectTasks.delete("/:projectId/tasks/:taskId", async (c) => {
  const projectId = parsePositiveId(c.req.param("projectId"));
  const taskId = parsePositiveId(c.req.param("taskId"));
  const user = c.get("user");

  if (projectId === null || taskId === null) {
    return c.json({ error: "Invalid project or task id" }, 400);
  }

  if (!(await userOwnsProject(projectId, user.id))) {
    return c.json({ error: "Project not found" }, 404);
  }

  const [deletedTask] = await db
    .delete(tasksTable)
    .where(
      and(eq(tasksTable.id, taskId), eq(tasksTable.projectId, projectId)),
    )
    .returning({ id: tasksTable.id });

  if (!deletedTask) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json({ message: "Task deleted successfully" });
});

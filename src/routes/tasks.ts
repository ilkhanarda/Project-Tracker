import { Hono } from "hono";
import { db } from "../db/index.js";

import { projectsTable, tasksTable } from "../db/schema.js";
import { eq, and } from "drizzle-orm";


import { z } from "zod";
import { zValidator } from "@hono/zod-validator";


const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  completed: z.boolean().optional(),
});

const updateTaskSchema = createTaskSchema
  .partial()
  .refine(
    (body) => Object.keys(body).length > 0,
    {
      message: "At least one field is required",
    }
  );

export const projectTasks = new Hono();

projectTasks.get("/:projectId/tasks", (c) => {
  const projectId = Number(c.req.param("projectId"));
    
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return c.json({ error: "Invalid project id" }, 400);
  } 

  const project = db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .get();

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const tasks = db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.projectId, projectId))
    .all();

  return c.json(tasks);
});

projectTasks.post(
    "/:projectId/tasks",
    zValidator("json", createTaskSchema),
    (c) => {
      const projectId = Number(c.req.param("projectId"));
      const body = c.req.valid("json");

      if (!Number.isInteger(projectId) || projectId <= 0) {
        return c.json({ error: "Invalid project id" }, 400);
      }

      const project = db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.id, projectId))
        .get();

      if (!project) {
        return c.json({ error: "Project not found" }, 404);
      }

      const task = db
        .insert(tasksTable)
        .values({
          title: body.title,
          completed: body.completed,
          projectId,
        })
        .returning()
        .get();

      return c.json(task, 201);
  }
);

projectTasks.get("/:projectId/tasks/:taskId", (c) => {
  const projectId = Number(c.req.param("projectId"));
  const taskId = Number(c.req.param("taskId"));

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return c.json({ error: "Invalid project id" }, 400);
  }

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return c.json({ error: "Invalid task id" }, 400);
  }

  const project = db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .get();

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const task = db
    .select()
    .from(tasksTable)
    .where(
        and(
            eq(tasksTable.id, taskId),
            eq(tasksTable.projectId, projectId)
        )
    )
    .get();

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json(task);
});

projectTasks.patch("/:projectId/tasks/:taskId", zValidator("json", updateTaskSchema), (c) => {
  const taskId = Number(c.req.param("taskId"));
  const projectId = Number(c.req.param("projectId"));
  const body = c.req.valid("json");

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return c.json({ error: "Invalid task id" }, 400);
  }
    if (!Number.isInteger(projectId) || projectId <= 0) {
    return c.json({ error: "Invalid project id" }, 400);
  }

  const task = db
    .select()
    .from(tasksTable)
    .where(
        and(
            eq(tasksTable.id, taskId),
            eq(tasksTable.projectId, projectId)
        )
    )
    .get();

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  const updatedTask = db
    .update(tasksTable)
    .set(body)
    .where(
        and(
            eq(tasksTable.id, taskId),
            eq(tasksTable.projectId, projectId)
        )
    )
    .returning()
    .get();

  return c.json(updatedTask);
});

projectTasks.delete("/:projectId/tasks/:taskId", (c) => {
  const taskId = Number(c.req.param("taskId"));
  const projectId = Number(c.req.param("projectId"));

  if (!Number.isInteger(taskId) || taskId <= 0) {
    return c.json({ error: "Invalid task id" }, 400);
  }
      if (!Number.isInteger(projectId) || projectId <= 0) {
    return c.json({ error: "Invalid project id" }, 400);
  }


  const task = db
    .select()
    .from(tasksTable)
    .where(
      and(
        eq(tasksTable.id, taskId),
        eq(tasksTable.projectId, projectId)
      )
    )
    .get();

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  db.delete(tasksTable)
    .where(
      and(
        eq(tasksTable.id, taskId),
        eq(tasksTable.projectId, projectId)
      )
    )
    .run();

  return c.json({ message: "Task deleted successfully" });
});

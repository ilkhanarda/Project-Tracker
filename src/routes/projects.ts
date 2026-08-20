import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { db } from "../db/index.js";
import { projectsTable } from "../db/schema.js";
import type { AppEnv } from "../lib/session.js";
import { requireAuth } from "../middleware/auth.js";

const projects = new Hono<AppEnv>();

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(2_000).optional(),
  pinned: z.boolean().optional(),
});

const updateProjectSchema = createProjectSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field is required",
  });

function parseProjectId(rawId: string) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

projects.use("*", requireAuth);

projects.get("/", async (c) => {
  const user = c.get("user");
  const result = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.userId, user.id));

  return c.json(result);
});

projects.get("/:id", async (c) => {
  const id = parseProjectId(c.req.param("id"));
  const user = c.get("user");

  if (id === null) {
    return c.json({ error: "Invalid project id" }, 400);
  }

  const [result] = await db
    .select()
    .from(projectsTable)
    .where(
      and(
        eq(projectsTable.id, id),
        eq(projectsTable.userId, user.id),
      ),
    )
    .limit(1);

  if (!result) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json(result);
});

projects.post("/", zValidator("json", createProjectSchema), async (c) => {
  const body = c.req.valid("json");
  const user = c.get("user");

  const [result] = await db
    .insert(projectsTable)
    .values({
      userId: user.id,
      name: body.name,
      description: body.description,
      pinned: body.pinned,
    })
    .returning();

  if (!result) {
    throw new Error("Project could not be created");
  }

  return c.json(result, 201);
});

projects.patch("/:id", zValidator("json", updateProjectSchema), async (c) => {
  const id = parseProjectId(c.req.param("id"));
  const body = c.req.valid("json");
  const user = c.get("user");

  if (id === null) {
    return c.json({ error: "Invalid project id" }, 400);
  }

  const ownershipFilter = and(
    eq(projectsTable.id, id),
    eq(projectsTable.userId, user.id),
  );

  const [currentProject] = await db
    .select()
    .from(projectsTable)
    .where(ownershipFilter)
    .limit(1);

  if (!currentProject) {
    return c.json({ error: "Project not found" }, 404);
  }

  const sameName = body.name === undefined || body.name === currentProject.name;
  const sameDescription =
    body.description === undefined ||
    body.description === currentProject.description;
  const samePinned =
    body.pinned === undefined || body.pinned === currentProject.pinned;

  if (sameName && sameDescription && samePinned) {
    return c.json(currentProject);
  }

  const [updatedProject] = await db
    .update(projectsTable)
    .set(body)
    .where(ownershipFilter)
    .returning();

  if (!updatedProject) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json(updatedProject);
});

projects.delete("/:id", async (c) => {
  const id = parseProjectId(c.req.param("id"));
  const user = c.get("user");

  if (id === null) {
    return c.json({ error: "Invalid project id" }, 400);
  }

  const [result] = await db
    .delete(projectsTable)
    .where(
      and(
        eq(projectsTable.id, id),
        eq(projectsTable.userId, user.id),
      ),
    )
    .returning({ id: projectsTable.id });

  if (!result) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json({ message: "Project deleted", id: result.id });
});

export default projects;

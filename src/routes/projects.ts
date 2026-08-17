import { Hono } from "hono";
import { db } from "../db/index.js";

import { projectsTable } from "../db/schema.js";
import { eq } from "drizzle-orm";

import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

const projects = new Hono();

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required" ),
  description: z.string().trim().optional(),
});

const updateProjectSchema = createProjectSchema.partial();

projects.get("/", (c) => {
    const result = db
    .select()
    .from(projectsTable)
    .all();

  return c.json(result);
});

projects.get("/:id", (c) => {
  const id = Number(c.req.param("id"));

  const result = db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id))
    .get();

  if (!result) {
    return c.text("Project not found", 404);
  }

  return c.json(result);
});


projects.post("/", zValidator("json", createProjectSchema), async (c) => {
  const body = c.req.valid("json");

  const result = db
    .insert(projectsTable)
    .values({
      name: body.name,
      description: body.description,
    })
    .returning()
    .get();

  return c.json(result, 201);
});

projects.patch("/:id", zValidator("json", updateProjectSchema), async (c) => {
  const id = Number(c.req.param("id"));
  const body = c.req.valid("json");

const currentProject = db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, id))
      .get();

    if (!currentProject) {
      return c.text("Project not found", 404);
    }

    const sameName =
      body.name === undefined || body.name === currentProject.name;

    const sameDescription =
      body.description === undefined ||
      body.description === currentProject.description;

    if (sameName && sameDescription) {
      return c.json(
        {
          message: "No changes to update",
        },
        200
      );
    }

    const updatedProject = db
      .update(projectsTable)
      .set(body)
      .where(eq(projectsTable.id, id))
      .returning()
      .get();

    return c.json(updatedProject);
});

projects.delete("/:id", (c) => {
  const id = Number(c.req.param("id"));

  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: "Invalid project id" }, 400);
  }

  const result = db
    .delete(projectsTable)
    .where(eq(projectsTable.id, id))
    .returning()
    .get();

  if (!result) {
    return c.text("Project not found", 404);
  }

  return c.json({
    message: "Project deleted",
    id,
  });
});

export default projects;

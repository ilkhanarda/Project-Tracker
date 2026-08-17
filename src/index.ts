import { serve } from "@hono/node-server";
import { Hono } from "hono";
import projects from "./routes/projects.js";
import { projectTasks } from "./routes/tasks.js";
import { cors } from "hono/cors";
import auth from "./routes/auth.js";

const app = new Hono();
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PATCH", "DELETE"],
  allowHeaders: ["Content-Type"],
}));

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.route("/auth", auth);
app.route("/projects", projects);
app.route("/projects", projectTasks);


serve(app);

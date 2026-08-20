import { serve } from "@hono/node-server";
import { Hono } from "hono";
import projects from "./routes/projects.js";
import { projectTasks } from "./routes/tasks.js";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import auth from "./routes/auth.js";

const app = new Hono();

const allowedOrigins = [
  process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  process.env.EXPO_WEB_ORIGIN ?? "http://localhost:8081",
  "http://127.0.0.1:8081",
];

app.use("*", secureHeaders());
app.use("*", cors({
  origin: allowedOrigins,
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.route("/auth", auth);
app.route("/projects", projects);
app.route("/projects", projectTasks);


serve(app);

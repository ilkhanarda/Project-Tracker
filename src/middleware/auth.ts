import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";

import {
  getBearerToken,
  getUserBySessionToken,
  SESSION_COOKIE_NAME,
  type AppEnv,
} from "../lib/session.js";

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const sessionToken =
    getCookie(c, SESSION_COOKIE_NAME) ??
    getBearerToken(c.req.header("Authorization"));

  if (!sessionToken) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const user = await getUserBySessionToken(sessionToken);

  if (!user) {
    return c.json({ error: "Session is invalid or expired" }, 401);
  }

  c.set("user", user);
  c.set("sessionToken", sessionToken);
  await next();
};

import "dotenv/config";

import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error("DATABASE_URL is required");

const sql = neon(databaseUrl);

const [counts] = await sql`
  SELECT
    (SELECT COUNT(*)::int FROM users) AS users,
    (SELECT COUNT(*)::int FROM projects) AS projects,
    (SELECT COUNT(*)::int FROM projects WHERE pinned) AS pinned_projects,
    (SELECT COUNT(*)::int FROM tasks) AS tasks,
    (SELECT COUNT(*)::int FROM sessions) AS sessions,
    (SELECT COUNT(*)::int FROM auth_tokens) AS auth_tokens
`;

const [orphans] = await sql`
  SELECT
    (SELECT COUNT(*)::int
       FROM projects p
       LEFT JOIN users u ON u.id = p.user_id
      WHERE u.id IS NULL) AS projects_without_user,
    (SELECT COUNT(*)::int
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
      WHERE p.id IS NULL) AS tasks_without_project
`;

console.info("Neon kayıt sayıları:", counts);
console.info("İlişki kontrolü:", orphans);

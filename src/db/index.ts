import "dotenv/config";

import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/node-sqlite";

const sqlite = new DatabaseSync(
  process.env.DB_FILE_NAME!
);

export const db = drizzle({
  client: sqlite,
});
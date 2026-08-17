import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"

export const projects = sqliteTable("projects", {
	id: integer().primaryKey({ autoIncrement: true }),
	name: text().notNull(),
});


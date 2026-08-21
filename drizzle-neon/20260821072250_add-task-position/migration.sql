ALTER TABLE "tasks" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "tasks_project_position_idx" ON "tasks" ("project_id","position");
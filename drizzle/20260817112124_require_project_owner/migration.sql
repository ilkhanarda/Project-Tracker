UPDATE `projects`
SET `user_id` = (
	SELECT `id`
	FROM `users`
	WHERE lower(`email`) = 'admin@admin.com'
	LIMIT 1
)
WHERE `user_id` IS NULL;
--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_projects_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_projects` (
	`id`,
	`user_id`,
	`name`,
	`description`,
	`created_at`,
	`updated_at`
)
SELECT
	`id`,
	`user_id`,
	`name`,
	`description`,
	`created_at`,
	`updated_at`
FROM `projects`;
--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`project_id` integer NOT NULL,
	`title` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT `fk_tasks_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `__new_projects`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_tasks` (
	`id`,
	`project_id`,
	`title`,
	`completed`,
	`created_at`,
	`updated_at`
)
SELECT
	`id`,
	`project_id`,
	`title`,
	`completed`,
	`created_at`,
	`updated_at`
FROM `tasks`;
--> statement-breakpoint
DROP TABLE `tasks`;
--> statement-breakpoint
DROP TABLE `projects`;
--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;
--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;
--> statement-breakpoint
CREATE INDEX `projects_user_id_idx` ON `projects` (`user_id`);
--> statement-breakpoint
CREATE INDEX `tasks_project_id_idx` ON `tasks` (`project_id`);
--> statement-breakpoint
CREATE INDEX `tasks_project_completed_idx` ON `tasks` (`project_id`, `completed`);

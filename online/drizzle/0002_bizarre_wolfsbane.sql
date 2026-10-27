CREATE TABLE `usage_alerts` (
	`user_id` text NOT NULL,
	`service_id` text NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`threshold` integer DEFAULT 20 NOT NULL,
	`notified` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `service_id`)
);

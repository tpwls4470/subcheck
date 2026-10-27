CREATE TABLE `usage_snapshots` (
	`user_id` text NOT NULL,
	`service_id` text NOT NULL,
	`observed_at` text NOT NULL,
	`windows` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `service_id`)
);

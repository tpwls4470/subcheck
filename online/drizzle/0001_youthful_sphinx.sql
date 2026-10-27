CREATE TABLE `push_devices` (
	`user_id` text NOT NULL,
	`device_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_sent` text,
	PRIMARY KEY(`user_id`, `device_id`)
);
--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `reminder_3` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `reminder_day` integer DEFAULT 0 NOT NULL;
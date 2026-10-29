CREATE TABLE `billing_sync_settings` (
	`user_id` text NOT NULL,
	`service_id` text NOT NULL,
	`enabled` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `service_id`)
);
--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `billing_observed_at` text;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `billing_synced_at` text;
CREATE TABLE `subscriptions` (
	`user_id` text NOT NULL,
	`service_id` text NOT NULL,
	`name` text NOT NULL,
	`plan` text,
	`amount` integer,
	`next_payment` text,
	`cycle` text DEFAULT 'unknown' NOT NULL,
	`channel` text DEFAULT 'unknown' NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	PRIMARY KEY(`user_id`, `service_id`)
);

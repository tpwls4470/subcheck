CREATE TABLE `billing_candidates` (
	`user_id` text NOT NULL,
	`service_id` text NOT NULL,
	`observed_at` text NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`user_id`, `service_id`)
);

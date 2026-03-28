CREATE TABLE `app_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`setting_key` varchar(100) NOT NULL,
	`setting_value` json,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_settings_setting_key_unique` UNIQUE(`setting_key`)
);
--> statement-breakpoint
CREATE TABLE `sales_targets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year_month` varchar(7) NOT NULL,
	`segment` varchar(50) NOT NULL,
	`target_value` decimal(18,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_targets_id` PRIMARY KEY(`id`)
);

CREATE TABLE `seller_monthly_targets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`seller_id` int NOT NULL,
	`seller_name` varchar(200) NOT NULL,
	`gestor_name` varchar(200) NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`target_type` enum('valor','quantidade') NOT NULL,
	`target_value` decimal(14,2) NOT NULL,
	`commission_percent` decimal(5,2) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seller_monthly_targets_id` PRIMARY KEY(`id`)
);

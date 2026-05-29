CREATE TABLE `sales_visit_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`seller_id` int NOT NULL,
	`seller_name` varchar(200) NOT NULL,
	`client_id` int,
	`client_name` varchar(300) NOT NULL,
	`client_city` varchar(200),
	`client_uf` varchar(2),
	`visit_date` timestamp NOT NULL,
	`visit_type` varchar(50) NOT NULL,
	`outcome` varchar(50) NOT NULL,
	`no_sale_reasons` json,
	`order_value` decimal(18,2),
	`notes` text,
	`next_steps` text,
	`next_visit_date` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_visit_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `import_payments` ADD `total_brasil_usd` decimal(18,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `import_payments` ADD `total_paraguai_usd` decimal(18,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `import_payments` ADD `arrival_date` varchar(50);
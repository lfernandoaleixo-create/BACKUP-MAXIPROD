CREATE TABLE `collection_manual_tick_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receivable_id` int NOT NULL,
	`step` int NOT NULL,
	`action` varchar(20) NOT NULL,
	`operator_name` varchar(100) NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `collection_manual_tick_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `collection_manual_ticks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receivable_id` int NOT NULL,
	`step` int NOT NULL,
	`ticked` boolean NOT NULL DEFAULT false,
	`ticked_by` varchar(100),
	`ticked_at` bigint,
	`created_at` bigint NOT NULL,
	CONSTRAINT `collection_manual_ticks_id` PRIMARY KEY(`id`)
);

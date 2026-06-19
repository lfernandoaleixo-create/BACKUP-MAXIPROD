CREATE TABLE `checklist_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sector` int NOT NULL,
	`sector_name` varchar(100) NOT NULL,
	`order_index` int NOT NULL,
	`text` text NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `checklist_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `checklist_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`round_id` int NOT NULL,
	`item_id` int NOT NULL,
	`response_status` enum('conforme','nao_conforme') NOT NULL,
	`observation` text,
	`photo_url` text,
	`photo_key` varchar(255),
	`responded_by` varchar(100) NOT NULL,
	`responded_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `checklist_responses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `checklist_rounds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(10) NOT NULL,
	`status` enum('open','completed','not_done') NOT NULL DEFAULT 'open',
	`completed_by` varchar(100),
	`completed_at` timestamp,
	`locked_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `checklist_rounds_id` PRIMARY KEY(`id`)
);

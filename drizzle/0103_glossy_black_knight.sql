CREATE TABLE `depot_inventory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productName` text NOT NULL,
	`quantityCx` int NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `depot_inventory_id` PRIMARY KEY(`id`)
);

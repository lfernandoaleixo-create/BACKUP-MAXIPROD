CREATE TABLE `collection_action_edits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dailyActionId` int NOT NULL,
	`receivableId` int NOT NULL,
	`fieldChanged` varchar(30) NOT NULL,
	`oldValue` text,
	`newValue` text,
	`editedBy` varchar(200) NOT NULL,
	`editedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `collection_action_edits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `accounts_receivable` ADD CONSTRAINT `accounts_receivable_maxiprodId_unique` UNIQUE(`maxiprodId`);
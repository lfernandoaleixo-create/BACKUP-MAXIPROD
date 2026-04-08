CREATE TABLE `collection_daily_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receivableId` int NOT NULL,
	`actionDate` varchar(10) NOT NULL,
	`actionType` varchar(30) NOT NULL,
	`operatorName` varchar(200) NOT NULL,
	`notes` text,
	`isAutomatic` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `collection_daily_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `receivable_protest_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receivableId` int NOT NULL,
	`protestType` enum('automatico','nao_protestar') NOT NULL DEFAULT 'automatico',
	`actionPlan` text,
	`deadlineDate` varchar(10),
	`actionPlanBy` varchar(200),
	`actionPlanAt` timestamp,
	`updatedBy` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `receivable_protest_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `receivable_protest_config_receivableId_unique` UNIQUE(`receivableId`)
);

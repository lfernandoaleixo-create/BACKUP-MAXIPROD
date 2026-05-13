CREATE TABLE `inadimplencia_backup` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotDate` timestamp NOT NULL DEFAULT (now()),
	`collectionActionsJson` json NOT NULL,
	`dailyActionsJson` json NOT NULL,
	`protestConfigJson` json NOT NULL,
	`resolvedJson` json NOT NULL,
	`totalCollectionActions` int NOT NULL,
	`totalDailyActions` int NOT NULL,
	`totalProtestConfigs` int NOT NULL,
	`totalResolved` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inadimplencia_backup_id` PRIMARY KEY(`id`)
);

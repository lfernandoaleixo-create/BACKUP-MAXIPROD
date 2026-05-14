CREATE TABLE `cobranca_planilha_backup` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotDate` timestamp NOT NULL DEFAULT (now()),
	`dataJson` json NOT NULL,
	`totalItems` int NOT NULL,
	`createdBy` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cobranca_planilha_backup_id` PRIMARY KEY(`id`)
);

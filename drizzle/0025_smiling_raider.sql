CREATE TABLE `daily_reconciliation` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(10) NOT NULL,
	`reconciled` boolean NOT NULL DEFAULT false,
	`notes` text,
	`totalRecebido` decimal(18,2),
	`totalPago` decimal(18,2),
	`saldo` decimal(18,2),
	`reconciledBy` varchar(200),
	`reconciledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_reconciliation_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_reconciliation_date_unique` UNIQUE(`date`)
);

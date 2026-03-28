CREATE TABLE `paid_accounts_monthly` (
	`id` int AUTO_INCREMENT NOT NULL,
	`yearMonth` varchar(7) NOT NULL,
	`totalPago` decimal(18,2) NOT NULL,
	`count` int NOT NULL,
	`source` varchar(20) NOT NULL DEFAULT 'liquidacaoData',
	`isComplete` boolean NOT NULL DEFAULT true,
	`lastUpdated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `paid_accounts_monthly_id` PRIMARY KEY(`id`),
	CONSTRAINT `paid_accounts_monthly_yearMonth_unique` UNIQUE(`yearMonth`)
);

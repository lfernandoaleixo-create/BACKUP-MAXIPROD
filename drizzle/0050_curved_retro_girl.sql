CREATE TABLE `bank_reconciliation` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(10) NOT NULL,
	`checkedBy` varchar(200) NOT NULL,
	`checkedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bank_reconciliation_id` PRIMARY KEY(`id`),
	CONSTRAINT `bank_reconciliation_date_unique` UNIQUE(`date`)
);

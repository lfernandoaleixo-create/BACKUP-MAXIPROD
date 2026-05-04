CREATE TABLE `cheque_custodians` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chequeId` int NOT NULL,
	`responsavel` varchar(100) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cheque_custodians_id` PRIMARY KEY(`id`)
);

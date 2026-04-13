CREATE TABLE `discount_selection_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`operatorName` varchar(200) NOT NULL,
	`empresa` varchar(200) NOT NULL,
	`contaLabel` varchar(300) NOT NULL,
	`mesKey` varchar(10) NOT NULL,
	`totalTitulos` int NOT NULL,
	`valorTotal` decimal(18,2) NOT NULL,
	`titulosJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `discount_selection_history_id` PRIMARY KEY(`id`)
);

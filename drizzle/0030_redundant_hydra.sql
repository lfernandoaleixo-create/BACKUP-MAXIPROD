CREATE TABLE `production_acceptance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedido` varchar(20) NOT NULL,
	`acceptedBy` varchar(200),
	`acceptedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `production_acceptance_id` PRIMARY KEY(`id`),
	CONSTRAINT `production_acceptance_pedido_unique` UNIQUE(`pedido`)
);

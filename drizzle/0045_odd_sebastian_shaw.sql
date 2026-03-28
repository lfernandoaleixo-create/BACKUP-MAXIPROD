CREATE TABLE `billing_observations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedido` varchar(20) NOT NULL,
	`observation` text NOT NULL,
	`updatedBy` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billing_observations_id` PRIMARY KEY(`id`),
	CONSTRAINT `billing_observations_pedido_unique` UNIQUE(`pedido`)
);

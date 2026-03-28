CREATE TABLE `production_status` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedido` varchar(20) NOT NULL,
	`status` varchar(50) NOT NULL,
	`updatedBy` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `production_status_id` PRIMARY KEY(`id`),
	CONSTRAINT `production_status_pedido_unique` UNIQUE(`pedido`)
);

CREATE TABLE `collection_status` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedido` varchar(20) NOT NULL,
	`pedidoColeta` boolean NOT NULL DEFAULT false,
	`coletado` boolean NOT NULL DEFAULT false,
	`updatedBy` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collection_status_id` PRIMARY KEY(`id`),
	CONSTRAINT `collection_status_pedido_unique` UNIQUE(`pedido`)
);

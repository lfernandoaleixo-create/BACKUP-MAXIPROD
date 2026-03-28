CREATE TABLE `transport_selection` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedido` varchar(20) NOT NULL,
	`transportadora` varchar(100) NOT NULL,
	`updatedBy` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transport_selection_id` PRIMARY KEY(`id`),
	CONSTRAINT `transport_selection_pedido_unique` UNIQUE(`pedido`)
);

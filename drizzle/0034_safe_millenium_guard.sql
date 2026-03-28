CREATE TABLE `production_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedido` varchar(20) NOT NULL,
	`note` text NOT NULL,
	`updatedBy` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `production_notes_id` PRIMARY KEY(`id`),
	CONSTRAINT `production_notes_pedido_unique` UNIQUE(`pedido`)
);

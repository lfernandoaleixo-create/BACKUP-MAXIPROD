CREATE TABLE `product_visibility` (
	`id` int AUTO_INCREMENT NOT NULL,
	`descricao` text NOT NULL,
	`codigoItem` varchar(20),
	`visible` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_visibility_id` PRIMARY KEY(`id`)
);

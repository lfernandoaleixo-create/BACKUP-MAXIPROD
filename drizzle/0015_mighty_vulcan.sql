CREATE TABLE `product_classification` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigoItem` varchar(20) NOT NULL,
	`descricao` text,
	`classification` enum('estoque','encomenda','outros') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_classification_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_classification_codigoItem_unique` UNIQUE(`codigoItem`)
);

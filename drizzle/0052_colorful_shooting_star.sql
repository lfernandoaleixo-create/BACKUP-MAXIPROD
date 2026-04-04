CREATE TABLE `semi_pronto_stock` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigoItem` varchar(20) NOT NULL,
	`quantidade` decimal(18,5) NOT NULL DEFAULT '0',
	`updatedBy` varchar(200),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `semi_pronto_stock_id` PRIMARY KEY(`id`),
	CONSTRAINT `semi_pronto_stock_codigoItem_unique` UNIQUE(`codigoItem`)
);

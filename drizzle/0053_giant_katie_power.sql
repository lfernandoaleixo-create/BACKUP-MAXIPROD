CREATE TABLE `aguardando_escolha_stock` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigoItem` varchar(20) NOT NULL,
	`quantidade` decimal(18,5) NOT NULL DEFAULT '0',
	`updatedBy` varchar(200),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `aguardando_escolha_stock_id` PRIMARY KEY(`id`),
	CONSTRAINT `aguardando_escolha_stock_codigoItem_unique` UNIQUE(`codigoItem`)
);

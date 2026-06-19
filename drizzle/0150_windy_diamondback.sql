CREATE TABLE `product_catalog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigoItem` varchar(20) NOT NULL,
	`descricaoItem` text NOT NULL,
	`grupoCodigo` varchar(20),
	`unidadeMedida` varchar(10),
	`source` varchar(20) NOT NULL DEFAULT 'stock',
	`firstSeenAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_catalog_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_catalog_codigoItem_unique` UNIQUE(`codigoItem`)
);

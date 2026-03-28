CREATE TABLE `product_pricing` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigoItem` varchar(20) NOT NULL,
	`mode` enum('auto','manual') NOT NULL DEFAULT 'auto',
	`manualPrice` decimal(18,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_pricing_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_pricing_codigoItem_unique` UNIQUE(`codigoItem`)
);

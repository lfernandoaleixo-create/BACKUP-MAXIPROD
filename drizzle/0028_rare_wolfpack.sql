CREATE TABLE `product_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parentCode` varchar(20) NOT NULL,
	`childCode` varchar(20) NOT NULL,
	`conversionFactor` decimal(10,5) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_variants_id` PRIMARY KEY(`id`)
);

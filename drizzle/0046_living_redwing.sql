CREATE TABLE `tracking_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedido` varchar(20) NOT NULL,
	`trackingUrl` text NOT NULL,
	`updatedBy` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tracking_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `tracking_links_pedido_unique` UNIQUE(`pedido`)
);

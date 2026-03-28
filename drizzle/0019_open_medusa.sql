CREATE TABLE `billing_authorizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedido` varchar(20) NOT NULL,
	`authorizedBy` varchar(200),
	`authorizedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_authorizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `billing_authorizations_pedido_unique` UNIQUE(`pedido`)
);

CREATE TABLE `payment_authorizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountPayableId` bigint NOT NULL,
	`authorized` boolean NOT NULL DEFAULT true,
	`authorizedAt` timestamp NOT NULL DEFAULT (now()),
	`notes` text,
	CONSTRAINT `payment_authorizations_id` PRIMARY KEY(`id`)
);

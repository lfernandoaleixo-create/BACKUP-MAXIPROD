CREATE TABLE `operators` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`password` varchar(255) NOT NULL DEFAULT '',
	`accessEstoque` boolean NOT NULL DEFAULT false,
	`accessVendas` boolean NOT NULL DEFAULT false,
	`accessFaturamento` boolean NOT NULL DEFAULT false,
	`accessFinanceiro` boolean NOT NULL DEFAULT false,
	`accessConfiguracoes` boolean NOT NULL DEFAULT false,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operators_id` PRIMARY KEY(`id`)
);

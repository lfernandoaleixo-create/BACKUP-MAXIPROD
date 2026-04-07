CREATE TABLE `madeira_stock` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigoItem` varchar(20) NOT NULL,
	`quantidade` decimal(18,5) NOT NULL DEFAULT '0',
	`updatedBy` varchar(200),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `madeira_stock_id` PRIMARY KEY(`id`),
	CONSTRAINT `madeira_stock_codigoItem_unique` UNIQUE(`codigoItem`)
);
--> statement-breakpoint
CREATE TABLE `stock_edit_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`card` varchar(30) NOT NULL,
	`codigoItem` varchar(20) NOT NULL,
	`descricaoItem` text,
	`valorAnterior` decimal(18,5) NOT NULL,
	`valorNovo` decimal(18,5) NOT NULL,
	`operador` varchar(200) NOT NULL,
	`tipo` varchar(20) NOT NULL DEFAULT 'alteracao',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_edit_history_id` PRIMARY KEY(`id`)
);

CREATE TABLE `queijo_coalho_stock` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigoItem` varchar(20) NOT NULL,
	`estoque_maxiprod` decimal(18,5) NOT NULL DEFAULT '0',
	`estoque_processado` decimal(18,5) NOT NULL DEFAULT '0',
	`estoque_regulador` decimal(18,5) NOT NULL DEFAULT '0',
	`updatedBy` varchar(200),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `queijo_coalho_stock_id` PRIMARY KEY(`id`),
	CONSTRAINT `queijo_coalho_stock_codigoItem_unique` UNIQUE(`codigoItem`)
);
--> statement-breakpoint
CREATE TABLE `queijo_coalho_stock_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigoItem` varchar(20) NOT NULL,
	`campo` varchar(50) NOT NULL,
	`valorAnterior` decimal(18,5) NOT NULL,
	`valorNovo` decimal(18,5) NOT NULL,
	`operador` varchar(200) NOT NULL,
	`observacao` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `queijo_coalho_stock_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `operators` ADD `accessGestaoComercial` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `operators` ADD `accessImportacao` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_managers` ADD `role` varchar(20) DEFAULT 'gestor' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_managers` ADD `parent_manager_id` int;--> statement-breakpoint
ALTER TABLE `sales_managers` ADD `maxiprod_name` varchar(200);
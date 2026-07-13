CREATE TABLE `lot_movements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lotId` int NOT NULL,
	`codigoLote` varchar(100) NOT NULL,
	`pedido` varchar(50),
	`cliente` varchar(300) NOT NULL,
	`qtdEnviada` decimal(18,2) NOT NULL,
	`dataEnvio` varchar(10) NOT NULL,
	`observacoes` text,
	`lancadoPor` varchar(200) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lot_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `production_lots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigo` varchar(100) NOT NULL,
	`codigoItem` varchar(20) NOT NULL,
	`descricaoItem` text NOT NULL,
	`notaCarga` varchar(50) NOT NULL,
	`dataProducao` varchar(10) NOT NULL,
	`qtdProduzida` decimal(18,2) NOT NULL,
	`saldoAtual` decimal(18,2) NOT NULL,
	`lancadoPor` varchar(200) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `production_lots_id` PRIMARY KEY(`id`),
	CONSTRAINT `production_lots_codigo_unique` UNIQUE(`codigo`)
);
--> statement-breakpoint
ALTER TABLE `seller_permissions` ADD `show_margin_bar` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `seller_permissions` ADD `show_margin_values` boolean DEFAULT false NOT NULL;
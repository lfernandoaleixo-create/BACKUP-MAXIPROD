CREATE TABLE `dashboard_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresa` varchar(100) NOT NULL,
	`dataJson` json NOT NULL,
	`computedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dashboard_data_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigoItem` varchar(20) NOT NULL,
	`descricao` text NOT NULL,
	`quantidade` decimal(18,5) NOT NULL,
	`unidadeMedida` varchar(10),
	`estadoNota` varchar(50),
	`estadoItem` varchar(50),
	`numeroPedido` varchar(20),
	`cliente` varchar(200),
	`dataEmissao` varchar(30),
	`valorUnitario` decimal(18,5),
	`valorTotal` decimal(18,2),
	`codigoGrupo` varchar(10),
	`empresaDona` varchar(100),
	`maxiprodId` bigint,
	`collectedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scraper_status` (
	`id` int AUTO_INCREMENT NOT NULL,
	`isConnected` boolean NOT NULL DEFAULT false,
	`lastSyncAt` timestamp,
	`lastSyncStatus` varchar(50),
	`lastError` text,
	`needsMfa` boolean NOT NULL DEFAULT false,
	`mfaCode` varchar(10),
	`sessionCookies` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scraper_status_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigoItem` varchar(20) NOT NULL,
	`descricaoItem` text NOT NULL,
	`quantidade` decimal(18,5) NOT NULL,
	`unidadeMedida` varchar(10),
	`custoUnitario` decimal(18,5),
	`custoTotal` decimal(18,2),
	`codigoGrupo` varchar(10),
	`descricaoGrupo` varchar(100),
	`codigoSuperGrupo` varchar(10),
	`descricaoSuperGrupo` varchar(100),
	`empresaDona` varchar(100),
	`estoqueLocal` varchar(100),
	`tipoDecodificado` varchar(50),
	`maxiprodId` bigint,
	`collectedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_items_id` PRIMARY KEY(`id`)
);

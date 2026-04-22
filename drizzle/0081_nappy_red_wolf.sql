CREATE TABLE `ecommerce_stock_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigoItem` varchar(20) NOT NULL,
	`descricaoItem` text NOT NULL,
	`quantidadeCx` decimal(18,5) NOT NULL,
	`quantidadeUn` decimal(18,5) NOT NULL,
	`snapshotDate` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ecommerce_stock_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ecommerce_transfer_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigoItem` varchar(20) NOT NULL,
	`descricaoItem` text NOT NULL,
	`quantidadeCxAnterior` decimal(18,5) NOT NULL,
	`quantidadeCxAtual` decimal(18,5) NOT NULL,
	`quantidadeTransferidaCx` decimal(18,5) NOT NULL,
	`quantidadeTransferidaUn` decimal(18,5) NOT NULL,
	`numeroPedido` varchar(20),
	`cliente` varchar(200),
	`dataTransferencia` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ecommerce_transfer_history_id` PRIMARY KEY(`id`)
);

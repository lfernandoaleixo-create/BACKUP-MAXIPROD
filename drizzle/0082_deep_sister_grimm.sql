CREATE TABLE `billed_industrialized_snapshot` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedido` varchar(20) NOT NULL,
	`codigoItem` varchar(50) NOT NULL,
	`quantidade` decimal(18,5) NOT NULL,
	`unidadeMedida` varchar(10),
	`snapshotDate` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `billed_industrialized_snapshot_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `industrialized_billing_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedido` varchar(20) NOT NULL,
	`codigoItem` varchar(50) NOT NULL,
	`descricaoItem` text,
	`cliente` varchar(300),
	`quantidade` decimal(18,5) NOT NULL,
	`unidadeMedida` varchar(10),
	`estoqueAnterior` decimal(18,5) NOT NULL,
	`estoqueNovo` decimal(18,5) NOT NULL,
	`dataFaturamento` varchar(30),
	`dataBaixa` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `industrialized_billing_history_id` PRIMARY KEY(`id`)
);

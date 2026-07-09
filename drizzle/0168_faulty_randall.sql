CREATE TABLE `collection_diary_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cliente_name` varchar(300) NOT NULL,
	`receivable_id` int,
	`etapa_atual` varchar(50) NOT NULL,
	`tipo_contato` varchar(30),
	`resumo` text NOT NULL,
	`observacoes` text,
	`valor_negociado` decimal(18,2),
	`proxima_acao` varchar(200),
	`proxima_acao_data` varchar(10),
	`operador_name` varchar(200) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `collection_diary_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `collection_diary_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshot_date` varchar(10) NOT NULL,
	`total_clientes` int NOT NULL,
	`total_titulos` int NOT NULL,
	`valor_total` decimal(18,2) NOT NULL,
	`entries_count` int NOT NULL,
	`snapshot_data` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `collection_diary_snapshots_id` PRIMARY KEY(`id`)
);

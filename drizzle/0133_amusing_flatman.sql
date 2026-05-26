CREATE TABLE `price_table_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`maxiprod_id` bigint NOT NULL,
	`price_table_id` int NOT NULL,
	`price_table_maxiprod_id` bigint NOT NULL,
	`item_id` bigint NOT NULL,
	`item_codigo` varchar(30) NOT NULL,
	`item_descricao` varchar(500) NOT NULL,
	`item_unidade` varchar(20),
	`preco` decimal(18,2) NOT NULL,
	`desconto_em_percentual` decimal(8,2),
	`desconto_maximo_em_percentual` decimal(8,2),
	`comissao_em_percentual` decimal(8,2),
	`preco_tipo` varchar(30),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `price_table_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `price_table_items_maxiprod_id_unique` UNIQUE(`maxiprod_id`)
);
--> statement-breakpoint
CREATE TABLE `price_tables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`maxiprod_id` bigint NOT NULL,
	`codigo` varchar(20) NOT NULL,
	`descricao` varchar(500) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `price_tables_id` PRIMARY KEY(`id`),
	CONSTRAINT `price_tables_maxiprod_id_unique` UNIQUE(`maxiprod_id`)
);

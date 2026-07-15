CREATE TABLE `retroactive_lot_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`solicitante_nome` varchar(200) NOT NULL,
	`codigo_item` varchar(20) NOT NULL,
	`descricao_item` text NOT NULL,
	`nota_carga` varchar(50) NOT NULL,
	`qtd_produzida` decimal(18,2) NOT NULL,
	`data_producao` varchar(10) NOT NULL,
	`codigo_lote_preview` varchar(100) NOT NULL,
	`motivo` text,
	`status` enum('pendente','aprovado','recusado') NOT NULL DEFAULT 'pendente',
	`aprovador_nome` varchar(200),
	`motivo_recusa` text,
	`data_decisao` timestamp,
	`lote_criado_id` int,
	`lote_criado_codigo` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `retroactive_lot_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `withdrawal_deletion_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`request_id` int NOT NULL,
	`product_code` varchar(50) NOT NULL,
	`product_name` varchar(300) NOT NULL,
	`quantity` varchar(20) NOT NULL,
	`motivo` varchar(50) NOT NULL,
	`solicitante_name` varchar(100) NOT NULL,
	`status` varchar(20) NOT NULL,
	`data_solicitacao` timestamp,
	`deleted_by_name` varchar(100) NOT NULL,
	`deleted_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `withdrawal_deletion_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `order_lot_assignments` MODIFY COLUMN `order_id` int;--> statement-breakpoint
ALTER TABLE `order_lot_assignments` ADD `pedido_numero` varchar(20);
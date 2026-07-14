CREATE TABLE `order_lot_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`lot_id` int NOT NULL,
	`codigo_lote` varchar(100) NOT NULL,
	`codigo_item` varchar(20) NOT NULL,
	`descricao_item` text,
	`qtd_caixas` decimal(18,2) NOT NULL,
	`atribuido_por` varchar(200) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_lot_assignments_id` PRIMARY KEY(`id`)
);

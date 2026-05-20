CREATE TABLE `stock_reservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`seller_id` int NOT NULL,
	`seller_name` varchar(200) NOT NULL,
	`codigo_item` varchar(20) NOT NULL,
	`descricao_item` text NOT NULL,
	`quantidade_cx` int NOT NULL,
	`cliente_nome` varchar(300) NOT NULL,
	`cliente_cnpj` varchar(20),
	`fonte` enum('estoque','po') NOT NULL DEFAULT 'estoque',
	`po_referencia` varchar(100),
	`po_data_entrega` varchar(30),
	`status_reserva` enum('ativa','cancelada','convertida') NOT NULL DEFAULT 'ativa',
	`observacao` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stock_reservations_id` PRIMARY KEY(`id`)
);

CREATE TABLE `transport_selection_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedido` varchar(20) NOT NULL,
	`transportadora_anterior` varchar(100),
	`transportadora_nova` varchar(100) NOT NULL,
	`alterado_por` varchar(200) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transport_selection_history_id` PRIMARY KEY(`id`)
);

CREATE TABLE `order_approval_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`pedido_numero` varchar(50),
	`cliente` varchar(300),
	`vendedor` varchar(200),
	`aprovado_por` varchar(200) NOT NULL,
	`tipo_aprovacao` varchar(50) NOT NULL,
	`observacao` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_approval_history_id` PRIMARY KEY(`id`)
);

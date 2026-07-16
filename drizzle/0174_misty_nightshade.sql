CREATE TABLE `stock_insufficient_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedido_numero` varchar(20) NOT NULL,
	`cliente` varchar(300),
	`codigo_item` varchar(50) NOT NULL,
	`descricao_item` text,
	`quantidade_pedida` decimal(18,5) NOT NULL,
	`unidade_medida` varchar(10),
	`estoque_disponivel` decimal(18,5),
	`status` varchar(20) NOT NULL DEFAULT 'pendente',
	`respondido_por` varchar(200),
	`resposta_observacao` text,
	`respondido_em` timestamp,
	`criado_por` varchar(100) DEFAULT 'sistema',
	`visualizado_por` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stock_insufficient_alerts_id` PRIMARY KEY(`id`)
);

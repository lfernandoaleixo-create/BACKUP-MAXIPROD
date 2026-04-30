CREATE TABLE `ecommerce_refunds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`descricao` varchar(500) NOT NULL,
	`fornecedor` varchar(300),
	`data_compra_original` varchar(10) NOT NULL,
	`data_estorno` varchar(10) NOT NULL,
	`valor_estorno` decimal(12,2) NOT NULL,
	`motivo` enum('produto_defeituoso','produto_errado','cancelamento','duplicidade','acordo_comercial','outro') NOT NULL,
	`motivo_detalhe` text,
	`status` enum('pendente','creditado') NOT NULL DEFAULT 'pendente',
	`data_creditado` varchar(10),
	`observacao` text,
	`registrado_por` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ecommerce_refunds_id` PRIMARY KEY(`id`)
);

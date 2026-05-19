CREATE TABLE `product_min_prices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigo_item` varchar(20) NOT NULL,
	`descricao_item` text NOT NULL,
	`preco_minimo` decimal(18,2) NOT NULL,
	`unidade_medida` varchar(10),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_min_prices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_order_request_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`codigo_item` varchar(20) NOT NULL,
	`descricao_item` text NOT NULL,
	`quantidade` decimal(18,3) NOT NULL,
	`unidade_medida` varchar(10),
	`preco_unitario` decimal(18,2) NOT NULL,
	`preco_minimo` decimal(18,2),
	`total_item` decimal(18,2) NOT NULL,
	`abaixo_do_minimo` boolean NOT NULL DEFAULT false,
	CONSTRAINT `sales_order_request_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_order_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`seller_id` int NOT NULL,
	`seller_name` varchar(200) NOT NULL,
	`status` enum('pendente','aprovado','rejeitado','processado') NOT NULL DEFAULT 'pendente',
	`cnpj_cpf` varchar(20) NOT NULL,
	`razao_social` varchar(300) NOT NULL,
	`nome_fantasia` varchar(300),
	`inscricao_estadual` varchar(30),
	`tipo_contribuinte` varchar(30),
	`regime_tributario` varchar(30),
	`email_nfe` varchar(300),
	`cnae_fiscal` varchar(20),
	`cep` varchar(10),
	`endereco` varchar(300),
	`numero` varchar(20),
	`complemento` varchar(200),
	`bairro` varchar(200),
	`municipio` varchar(200),
	`uf` varchar(2),
	`telefone1` varchar(20),
	`telefone2` varchar(20),
	`email_contato` varchar(300),
	`segmento` varchar(100),
	`condicao_pagamento` varchar(200),
	`valor_frete` decimal(18,2),
	`tipo_frete` varchar(50),
	`observacoes` text,
	`total_produtos` decimal(18,2) NOT NULL,
	`total_pedido` decimal(18,2) NOT NULL,
	`tem_preco_abaixo_minimo` boolean NOT NULL DEFAULT false,
	`motivo_alerta` text,
	`aprovado_por` varchar(100),
	`data_aprovacao` timestamp,
	`motivo_rejeicao` text,
	`processado_por` varchar(100),
	`data_processamento` timestamp,
	`numero_pedido_maxiprod` varchar(30),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_order_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `catalogs` ADD `folder` varchar(200) DEFAULT 'Catálogos' NOT NULL;
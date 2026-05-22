CREATE TABLE `credit_card_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`card_id` int NOT NULL,
	`data_compra` varchar(20),
	`estabelecimento` varchar(200),
	`descricao_despesa` varchar(500),
	`centro_de_custo` varchar(200),
	`valor_total` decimal(18,2),
	`quant_parcelas` int DEFAULT 1,
	`valor_parcela` decimal(18,2),
	`mes_inicio` varchar(7),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_card_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`titular_cartao` varchar(200) NOT NULL,
	`vencimento_fatura` tinyint,
	`fechamento_fatura` tinyint,
	`previsao_pagamento` varchar(100),
	`limite_total` decimal(18,2),
	`limite_utilizado` decimal(18,2),
	`limite_disponivel` decimal(18,2),
	`automatizar` boolean DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_cards_id` PRIMARY KEY(`id`)
);

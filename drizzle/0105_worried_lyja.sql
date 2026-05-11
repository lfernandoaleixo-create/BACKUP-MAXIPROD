CREATE TABLE `ecommerce_credit_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(200) NOT NULL,
	`bandeira` varchar(50) NOT NULL,
	`ultimos4` varchar(4) NOT NULL,
	`titular` varchar(200) NOT NULL,
	`ativo` tinyint NOT NULL DEFAULT 1,
	`registrado_por` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ecommerce_credit_cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ecommerce_expenses` ADD `recorrente` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ecommerce_expenses` ADD `cartao_id` int;
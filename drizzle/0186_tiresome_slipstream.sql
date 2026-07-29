CREATE TABLE `order_timeline_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`seller_id` int NOT NULL,
	`seller_name` varchar(200) NOT NULL,
	`recipient_id` int NOT NULL,
	`recipient_name` varchar(200) NOT NULL,
	`recipient_type` varchar(20) NOT NULL,
	`condition_type` varchar(50) NOT NULL,
	`condition_value` decimal(5,2),
	`action_type` varchar(20) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_timeline_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `import_pos` MODIFY COLUMN `frete_terrestre_remessa` decimal(18,6);--> statement-breakpoint
ALTER TABLE `import_pos` MODIFY COLUMN `difal_valor` decimal(18,6);--> statement-breakpoint
ALTER TABLE `import_pos` MODIFY COLUMN `comissao_silverio` decimal(18,6);--> statement-breakpoint
ALTER TABLE `import_pos` MODIFY COLUMN `despesas_liberacao_remessa` decimal(18,6);--> statement-breakpoint
ALTER TABLE `import_pos` MODIFY COLUMN `vilela_valor_real` decimal(18,6);
CREATE TABLE `import_spreadsheet_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplier_id` int NOT NULL,
	`section_title` varchar(200),
	`columns` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `import_spreadsheet_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seller_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planilha_id` int,
	`empresa` varchar(300) NOT NULL,
	`cnpj` varchar(20),
	`vendedor` varchar(200) NOT NULL,
	`mensagem` text NOT NULL,
	`valor_total` decimal(18,2),
	`titulos_vencidos` int,
	`dias_atraso_max` int,
	`criado_por` varchar(200) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pendente',
	`resposta_vendedor` text,
	`viewed_at` timestamp,
	`resolved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seller_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `import_payments` MODIFY COLUMN `total_usd` decimal(18,10) NOT NULL;--> statement-breakpoint
ALTER TABLE `import_payments` MODIFY COLUMN `half_value` decimal(18,10);--> statement-breakpoint
ALTER TABLE `import_payments` MODIFY COLUMN `total_brasil_usd` decimal(18,10) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `import_payments` MODIFY COLUMN `total_paraguai_usd` decimal(18,10) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `import_payments` MODIFY COLUMN `brasil_usd` decimal(18,10) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `import_payments` MODIFY COLUMN `paraguai_usd` decimal(18,10) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `import_payments` MODIFY COLUMN `total_pago` decimal(18,10) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `import_payments` MODIFY COLUMN `saldo_devedor_brasil` decimal(18,10) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `import_payments` MODIFY COLUMN `saldo_devedor_paraguai` decimal(18,10) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `import_payments` MODIFY COLUMN `saldo_devedor_total` decimal(18,10) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `import_payments` ADD `cells` json;--> statement-breakpoint
ALTER TABLE `import_payments` ADD `sort_order` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `representante2` varchar(200);
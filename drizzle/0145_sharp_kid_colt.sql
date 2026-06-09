CREATE TABLE `import_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`config_key` varchar(50) NOT NULL,
	`config_value` varchar(200) NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `import_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `import_icms_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`uf` varchar(2) NOT NULL,
	`state_name` varchar(50) NOT NULL,
	`icms_rate` decimal(5,2) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `import_icms_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `import_ncm_taxes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ncm` varchar(15) NOT NULL,
	`description` varchar(200),
	`ii_rate` decimal(5,2) NOT NULL DEFAULT '0',
	`ipi_rate` decimal(5,2) NOT NULL DEFAULT '0',
	`pis_rate` decimal(5,2) NOT NULL DEFAULT '2.10',
	`cofins_rate` decimal(5,2) NOT NULL DEFAULT '9.65',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `import_ncm_taxes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `import_po_products` ADD `ci_value_usd` decimal(10,4);--> statement-breakpoint
ALTER TABLE `import_po_products` ADD `total_freight_usd` decimal(10,4);--> statement-breakpoint
ALTER TABLE `import_po_products` ADD `frete_maritimo` decimal(10,4);--> statement-breakpoint
ALTER TABLE `import_po_products` ADD `frete_terrestre` decimal(10,4);--> statement-breakpoint
ALTER TABLE `import_po_products` ADD `incoterm` varchar(10);--> statement-breakpoint
ALTER TABLE `import_po_products` ADD `ii_valor` decimal(12,2);--> statement-breakpoint
ALTER TABLE `import_po_products` ADD `ipi_valor` decimal(12,2);--> statement-breakpoint
ALTER TABLE `import_po_products` ADD `pis_valor` decimal(12,2);--> statement-breakpoint
ALTER TABLE `import_po_products` ADD `cofins_valor` decimal(12,2);--> statement-breakpoint
ALTER TABLE `import_po_products` ADD `icms_valor` decimal(12,2);--> statement-breakpoint
ALTER TABLE `import_po_products` ADD `total_impostos` decimal(12,2);--> statement-breakpoint
ALTER TABLE `import_pos` ADD `avg_dollar_rate` decimal(6,4);--> statement-breakpoint
ALTER TABLE `import_pos` ADD `total_ci_usd` decimal(12,2);--> statement-breakpoint
ALTER TABLE `import_pos` ADD `pdf_url` text;--> statement-breakpoint
ALTER TABLE `import_pos` ADD `pdf_nota_cheia_url` text;--> statement-breakpoint
ALTER TABLE `import_pos` ADD `porto_chegada` varchar(100);--> statement-breakpoint
ALTER TABLE `import_pos` ADD `cidade_desembaraco` varchar(100);--> statement-breakpoint
ALTER TABLE `import_pos` ADD `local_final` varchar(100);--> statement-breakpoint
ALTER TABLE `import_pos` ADD `pagamento_1_remessa` decimal(12,2);--> statement-breakpoint
ALTER TABLE `import_pos` ADD `pagamento_2_remessa` decimal(12,2);--> statement-breakpoint
ALTER TABLE `import_pos` ADD `pagamento_3_remessa` decimal(12,2);--> statement-breakpoint
ALTER TABLE `import_pos` ADD `taxas_remessa` decimal(12,2);--> statement-breakpoint
ALTER TABLE `import_pos` ADD `frete_terrestre_remessa` decimal(12,2);--> statement-breakpoint
ALTER TABLE `import_pos` ADD `difal_valor` decimal(12,2);--> statement-breakpoint
ALTER TABLE `import_pos` ADD `comissao_silverio` decimal(12,2);--> statement-breakpoint
ALTER TABLE `import_pos` ADD `despesas_liberacao_remessa` decimal(12,2);--> statement-breakpoint
ALTER TABLE `import_pos` ADD `valor_dolar_1_remessa` decimal(8,4);--> statement-breakpoint
ALTER TABLE `import_pos` ADD `valor_dolar_2_remessa` decimal(8,4);--> statement-breakpoint
ALTER TABLE `import_pos` ADD `valor_dolar_3_remessa` decimal(8,4);--> statement-breakpoint
ALTER TABLE `import_pos` ADD `valor_frete_maritimo_usd` decimal(12,2);--> statement-breakpoint
ALTER TABLE `import_pos` ADD `total_ci_remessa` decimal(12,2);--> statement-breakpoint
ALTER TABLE `import_pos` ADD `valor_total_produtos_usd_remessa` decimal(12,2);
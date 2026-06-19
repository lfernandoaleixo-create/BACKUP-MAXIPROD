ALTER TABLE `import_po_products` MODIFY COLUMN `valor_caixa_brl` decimal(12,6);--> statement-breakpoint
ALTER TABLE `import_po_products` MODIFY COLUMN `preco_mil_unid` decimal(12,6);--> statement-breakpoint
ALTER TABLE `import_ncm_taxes` ADD `grupo` varchar(100);--> statement-breakpoint
ALTER TABLE `import_pos` ADD `navigation_status` varchar(20) DEFAULT 'navegando';--> statement-breakpoint
ALTER TABLE `import_pos` ADD `previsao_entrega` varchar(50);
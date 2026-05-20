ALTER TABLE `stock_items` ADD `pesoLiquido` decimal(18,5);--> statement-breakpoint
ALTER TABLE `stock_items` ADD `pesoBruto` decimal(18,5);--> statement-breakpoint
ALTER TABLE `stock_items` ADD `codigoBarras` varchar(50);--> statement-breakpoint
ALTER TABLE `stock_items` ADD `descricaoComplementar` text;--> statement-breakpoint
ALTER TABLE `stock_items` ADD `procedencia` varchar(50);--> statement-breakpoint
ALTER TABLE `stock_items` ADD `estado` varchar(20);--> statement-breakpoint
ALTER TABLE `stock_items` ADD `unidadeDeVendaCodigo` varchar(10);
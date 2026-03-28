ALTER TABLE `sales_orders` ADD `unidadeMedidaCodigo` varchar(10);--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `unidadeMedidaDescricao` varchar(50);--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `quantidadeUnidadeItem` decimal(18,5);--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `ncm` varchar(20);--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `clienteTelefone` varchar(50);--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `clienteEmail` varchar(200);--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `transportadoraRazaoSocial` varchar(300);--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `grupoDescricao` varchar(100);
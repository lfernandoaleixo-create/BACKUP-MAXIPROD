ALTER TABLE `order_items` ADD `dataEntregaItem` varchar(50);--> statement-breakpoint
ALTER TABLE `order_items` ADD `ncm` varchar(20);--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `condicaoPagamento` varchar(100);--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `transportadora` varchar(300);--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `razaoSocial` varchar(300);--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `inscricaoEstadual` varchar(30);--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `enderecoLogradouro` varchar(300);--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `enderecoNumero` varchar(20);--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `enderecoComplemento` varchar(200);--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `enderecoBairro` varchar(200);--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `enderecoCep` varchar(15);--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `enderecoCidade` varchar(200);--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `valorTotalPedido` decimal(18,2);
ALTER TABLE `sales_order_requests` ADD `comissao_fonte` varchar(30);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `comissao_percentual` decimal(5,2);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `comissao_tier` varchar(30);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `margem_percentual` decimal(5,2);
ALTER TABLE `sales_order_requests` MODIFY COLUMN `telefone1` varchar(100);--> statement-breakpoint
ALTER TABLE `sales_order_requests` MODIFY COLUMN `telefone2` varchar(100);--> statement-breakpoint
ALTER TABLE `sales_order_requests` MODIFY COLUMN `redespacho_telefone` varchar(100);--> statement-breakpoint
ALTER TABLE `sales_order_requests` MODIFY COLUMN `entrega_telefone` varchar(100);--> statement-breakpoint
ALTER TABLE `vendor_clients` MODIFY COLUMN `telefone1` varchar(100);--> statement-breakpoint
ALTER TABLE `vendor_clients` MODIFY COLUMN `telefone2` varchar(100);--> statement-breakpoint
ALTER TABLE `vendor_clients` MODIFY COLUMN `redespacho_telefone` varchar(100);--> statement-breakpoint
ALTER TABLE `vendor_clients` MODIFY COLUMN `entrega_telefone` varchar(100);--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `observacoesInternas` text;
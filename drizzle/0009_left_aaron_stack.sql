ALTER TABLE `order_items` MODIFY COLUMN `codigoGrupo` varchar(50);--> statement-breakpoint
ALTER TABLE `purchase_order_items` MODIFY COLUMN `codigoGrupo` varchar(50);--> statement-breakpoint
ALTER TABLE `sales_invoice_items` MODIFY COLUMN `codigoGrupo` varchar(50);--> statement-breakpoint
ALTER TABLE `sales_orders` MODIFY COLUMN `codigoGrupo` varchar(50);--> statement-breakpoint
ALTER TABLE `stock_items` MODIFY COLUMN `codigoGrupo` varchar(50);--> statement-breakpoint
ALTER TABLE `stock_items` MODIFY COLUMN `codigoSuperGrupo` varchar(50);
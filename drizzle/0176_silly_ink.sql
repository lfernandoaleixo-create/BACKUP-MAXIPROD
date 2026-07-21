ALTER TABLE `sales_order_requests` ADD `observacao_aprovacao` text;--> statement-breakpoint
ALTER TABLE `seller_alerts` ADD `cancelled_by` varchar(200);--> statement-breakpoint
ALTER TABLE `seller_alerts` ADD `cancel_reason` text;--> statement-breakpoint
ALTER TABLE `seller_alerts` ADD `cancelled_at` timestamp;
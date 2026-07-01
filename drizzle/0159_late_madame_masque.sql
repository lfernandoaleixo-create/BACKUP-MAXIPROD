ALTER TABLE `catalogs` MODIFY COLUMN `url` varchar(500) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `catalogs` ADD `parent_id` int;--> statement-breakpoint
ALTER TABLE `catalogs` ADD `is_folder` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `catalogs` ADD `mime_type` varchar(100);--> statement-breakpoint
ALTER TABLE `catalogs` ADD `file_size` int;--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `vitoria_recebido` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `vitoria_recebido_at` timestamp;--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `vitoria_lancado` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `vitoria_lancado_at` timestamp;
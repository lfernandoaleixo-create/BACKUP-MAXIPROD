CREATE TABLE `import_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplier_id` int NOT NULL,
	`status` varchar(200) NOT NULL,
	`pedido` varchar(100) NOT NULL,
	`doc` varchar(20) NOT NULL,
	`total_usd` decimal(18,2) NOT NULL,
	`half_value` decimal(18,2),
	`brasil_usd` decimal(18,2) NOT NULL DEFAULT '0',
	`paraguai_usd` decimal(18,2) NOT NULL DEFAULT '0',
	`total_pago` decimal(18,2) NOT NULL DEFAULT '0',
	`saldo_devedor_brasil` decimal(18,2) NOT NULL DEFAULT '0',
	`saldo_devedor_paraguai` decimal(18,2) NOT NULL DEFAULT '0',
	`saldo_devedor_total` decimal(18,2) NOT NULL DEFAULT '0',
	`rastreio` varchar(200),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `import_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `import_suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`category` varchar(100),
	`display_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `import_suppliers_id` PRIMARY KEY(`id`)
);

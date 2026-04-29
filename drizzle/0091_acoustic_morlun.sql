CREATE TABLE `discount_alert_reads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alert_id` int NOT NULL,
	`read_by` varchar(100) NOT NULL,
	`read_at` bigint NOT NULL,
	CONSTRAINT `discount_alert_reads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `discount_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`created_by` varchar(100) NOT NULL,
	`empresa` varchar(200) NOT NULL,
	`conta_label` varchar(300) NOT NULL,
	`mes_key` varchar(10) NOT NULL,
	`total_titulos` int NOT NULL,
	`valor_total` decimal(18,2) NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `discount_alerts_id` PRIMARY KEY(`id`)
);

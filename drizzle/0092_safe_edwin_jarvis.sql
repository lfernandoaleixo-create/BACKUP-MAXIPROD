CREATE TABLE `annotation_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tipo` varchar(50) NOT NULL,
	`data` varchar(10) NOT NULL,
	`sector_id` int,
	`quantidade` decimal(18,5) NOT NULL DEFAULT '0',
	`observacoes` text,
	`lancado_por` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `annotation_entries_id` PRIMARY KEY(`id`)
);

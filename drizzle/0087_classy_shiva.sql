CREATE TABLE `decision_pdf_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receivable_id` int NOT NULL,
	`cliente` varchar(500) NOT NULL,
	`vendedor` varchar(255),
	`valor_aberto` varchar(50),
	`dias_atraso` int,
	`decisao` varchar(100),
	`protocolo` varchar(100) NOT NULL,
	`file_key` varchar(500) NOT NULL,
	`file_url` varchar(1000) NOT NULL,
	`generated_by` varchar(100) NOT NULL,
	`generated_at` bigint NOT NULL,
	CONSTRAINT `decision_pdf_history_id` PRIMARY KEY(`id`)
);

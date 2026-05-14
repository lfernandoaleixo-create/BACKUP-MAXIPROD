CREATE TABLE `ecommerce_future_bills` (
	`id` int AUTO_INCREMENT NOT NULL,
	`descricao` varchar(500) NOT NULL,
	`dataVencimento` varchar(10) NOT NULL,
	`formaPagamento` enum('pix','boleto','cartao_credito') NOT NULL,
	`parcelas` int NOT NULL DEFAULT 1,
	`valorTotal` decimal(12,2) NOT NULL,
	`observacao` text,
	`recorrente` tinyint NOT NULL DEFAULT 0,
	`cartao_id` int,
	`status` enum('pendente','pago','cancelado') NOT NULL DEFAULT 'pendente',
	`registradoPor` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ecommerce_future_bills_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `future_bill_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bill_id` int NOT NULL,
	`file_name` varchar(500) NOT NULL,
	`file_url` text NOT NULL,
	`file_key` varchar(500) NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`file_size` int NOT NULL,
	`uploaded_by` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `future_bill_attachments_id` PRIMARY KEY(`id`)
);

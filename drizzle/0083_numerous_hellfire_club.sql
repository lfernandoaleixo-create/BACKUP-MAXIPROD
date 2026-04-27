CREATE TABLE `ecommerce_expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`descricao` varchar(500) NOT NULL,
	`dataCompra` varchar(10) NOT NULL,
	`formaPagamento` enum('pix','boleto','cartao_credito') NOT NULL,
	`parcelas` int NOT NULL DEFAULT 1,
	`valorTotal` decimal(12,2) NOT NULL,
	`observacao` text,
	`registradoPor` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ecommerce_expenses_id` PRIMARY KEY(`id`)
);

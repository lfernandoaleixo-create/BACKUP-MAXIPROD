CREATE TABLE `cheque_exchanges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empresaNome` varchar(100) NOT NULL,
	`operador` varchar(100) NOT NULL,
	`chequesJson` text NOT NULL,
	`totalValor` decimal(18,2) NOT NULL,
	`totalCheques` int NOT NULL,
	`pdfUrl` text,
	`pdfKey` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cheque_exchanges_id` PRIMARY KEY(`id`)
);

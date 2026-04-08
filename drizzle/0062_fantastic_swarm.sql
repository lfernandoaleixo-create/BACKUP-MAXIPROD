CREATE TABLE `collection_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receivableId` int NOT NULL,
	`cliente` varchar(300) NOT NULL,
	`vendedor` varchar(200) NOT NULL,
	`valorTitulo` decimal(18,2) NOT NULL,
	`vencimentoData` varchar(10) NOT NULL,
	`diasAtraso` int NOT NULL,
	`documento` varchar(100),
	`acoesCobanca` json DEFAULT ('[]'),
	`documentoTexto` text NOT NULL,
	`geradoPor` varchar(200) NOT NULL DEFAULT 'Sistema',
	`visualizadoPorVendedor` boolean NOT NULL DEFAULT false,
	`visualizadoEm` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `collection_documents_id` PRIMARY KEY(`id`)
);

CREATE TABLE `collection_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receivableId` int NOT NULL,
	`status` varchar(30) NOT NULL DEFAULT 'pendente',
	`promessaData` varchar(30),
	`promessaValor` decimal(18,2),
	`lembreteData` varchar(30),
	`observacoes` text,
	`contatoHistorico` json,
	`updatedBy` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collection_actions_id` PRIMARY KEY(`id`)
);

CREATE TABLE `pirografia_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sectorId` int NOT NULL,
	`machineId` int NOT NULL,
	`data` varchar(10) NOT NULL,
	`codigoItem` varchar(20) NOT NULL,
	`descricaoItem` text,
	`materialOrigem` varchar(20) NOT NULL,
	`nomePirografado` varchar(300) NOT NULL,
	`quantidade` decimal(18,5) NOT NULL,
	`observacoes` text,
	`lancadoPor` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pirografia_entries_id` PRIMARY KEY(`id`)
);

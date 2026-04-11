CREATE TABLE `production_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sectorId` int NOT NULL,
	`machineId` int,
	`data` varchar(10) NOT NULL,
	`quantidade` decimal(18,5) NOT NULL,
	`observacoes` text,
	`lancadoPor` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `production_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `production_machines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sectorId` int NOT NULL,
	`nome` varchar(100) NOT NULL,
	`ordem` int NOT NULL,
	`ativa` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `production_machines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `production_sectors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ordem` int NOT NULL,
	`nome` varchar(100) NOT NULL,
	`unidadeMedida` varchar(50) NOT NULL,
	`unidadeLabel` varchar(50) NOT NULL,
	`tipoEquipamento` varchar(20) NOT NULL,
	`quantidadeEquipamentos` int NOT NULL DEFAULT 0,
	`isSequencial` boolean NOT NULL DEFAULT false,
	`cor` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `production_sectors_id` PRIMARY KEY(`id`)
);

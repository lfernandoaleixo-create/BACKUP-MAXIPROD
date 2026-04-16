CREATE TABLE `resolved_receivables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receivableId` int NOT NULL,
	`maxiprodId` bigint NOT NULL,
	`cliente` varchar(300) NOT NULL,
	`valorOriginal` decimal(18,2) NOT NULL,
	`valorAReceber` decimal(18,2) NOT NULL,
	`vencimentoData` varchar(50),
	`documento` varchar(100),
	`empresa` varchar(100),
	`vendedor` varchar(200),
	`diasAtrasoNaResolucao` int NOT NULL DEFAULT 0,
	`statusCobranca` varchar(30),
	`totalContatos` int NOT NULL DEFAULT 0,
	`resolvedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `resolved_receivables_id` PRIMARY KEY(`id`)
);

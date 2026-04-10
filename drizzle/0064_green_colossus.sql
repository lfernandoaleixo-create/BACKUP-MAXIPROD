CREATE TABLE `financial_changes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`changeDate` varchar(10) NOT NULL,
	`tipo` varchar(10) NOT NULL,
	`changeType` varchar(20) NOT NULL,
	`maxiprodId` bigint NOT NULL,
	`nome` varchar(300) NOT NULL,
	`valor` decimal(18,2) NOT NULL,
	`valorAnterior` decimal(18,2),
	`vencimentoData` varchar(50),
	`referenteA` text,
	`observacoes` text,
	`parcela` varchar(20),
	`empresaNome` varchar(100),
	`semanaLabel` varchar(30),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `financial_changes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financial_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshotDate` varchar(10) NOT NULL,
	`tipo` varchar(10) NOT NULL,
	`maxiprodId` bigint NOT NULL,
	`nome` varchar(300) NOT NULL,
	`valor` decimal(18,2) NOT NULL,
	`vencimentoData` varchar(50),
	`referenteA` text,
	`observacoes` text,
	`parcela` varchar(20),
	`empresaNome` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `financial_snapshots_id` PRIMARY KEY(`id`)
);

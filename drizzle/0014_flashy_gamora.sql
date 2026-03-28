CREATE TABLE `bank_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`maxiprodId` bigint NOT NULL,
	`bancoNome` varchar(200),
	`agencia` varchar(20),
	`contaNumero` varchar(30),
	`empresaId` bigint,
	`empresaNome` varchar(100),
	`ativo` boolean DEFAULT true,
	`saldoInicial` decimal(18,2) DEFAULT '0',
	`saldoInicialData` varchar(30),
	`collectedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bank_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `bank_accounts_maxiprodId_unique` UNIQUE(`maxiprodId`)
);
--> statement-breakpoint
CREATE TABLE `bank_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`maxiprodId` bigint NOT NULL,
	`data` varchar(30) NOT NULL,
	`descricao` text,
	`valor` decimal(18,2) NOT NULL,
	`contaBancariaId` bigint NOT NULL,
	`collectedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bank_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `bank_transactions_maxiprodId_unique` UNIQUE(`maxiprodId`)
);

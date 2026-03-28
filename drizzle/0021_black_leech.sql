ALTER TABLE `bank_accounts` ADD `codigoEstruturado` varchar(30);--> statement-breakpoint
ALTER TABLE `bank_accounts` ADD `contaContabilId` bigint;--> statement-breakpoint
ALTER TABLE `bank_accounts` ADD `saldoContabil` decimal(18,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `bank_accounts` ADD `totalDebitos` decimal(18,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `bank_accounts` ADD `totalCreditos` decimal(18,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `bank_accounts` ADD `saldoContabilAtualizadoEm` timestamp;
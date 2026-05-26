CREATE TABLE `deferred_payment_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`account_payable_id` bigint NOT NULL,
	`note` text,
	`reprogram_date` varchar(10),
	`created_by` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deferred_payment_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `accounts_receivable` ADD `situacaoTitulo` varchar(200);
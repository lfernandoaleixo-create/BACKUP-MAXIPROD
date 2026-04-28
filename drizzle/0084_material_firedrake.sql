CREATE TABLE `collection_step_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receivable_id` int NOT NULL,
	`step` int NOT NULL,
	`descricao` text,
	`motivo` text,
	`updated_by` varchar(100),
	`updated_at` bigint NOT NULL,
	CONSTRAINT `collection_step_overrides_id` PRIMARY KEY(`id`)
);

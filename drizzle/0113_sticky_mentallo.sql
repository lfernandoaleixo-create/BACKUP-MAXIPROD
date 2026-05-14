CREATE TABLE `cobranca_etapa_obs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planilha_id` int NOT NULL,
	`etapa` varchar(50) NOT NULL,
	`observacao` text NOT NULL,
	`registrado_por` varchar(200) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cobranca_etapa_obs_id` PRIMARY KEY(`id`)
);

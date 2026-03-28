CREATE TABLE `product_segment_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`descricao` text NOT NULL,
	`codigoGrupo` varchar(10),
	`segment` varchar(50) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_segment_overrides_id` PRIMARY KEY(`id`)
);

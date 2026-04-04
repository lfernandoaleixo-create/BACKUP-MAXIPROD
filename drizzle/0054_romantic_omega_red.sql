CREATE TABLE `madeira_visibility` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigoItem` varchar(20) NOT NULL,
	`card` varchar(30) NOT NULL,
	`visible` boolean NOT NULL DEFAULT true,
	`updatedBy` varchar(200),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `madeira_visibility_id` PRIMARY KEY(`id`)
);

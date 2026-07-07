CREATE TABLE `commission_matrix` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gestor_name` varchar(200) NOT NULL,
	`meta_percent` int NOT NULL,
	`price_tier` enum('mostrado_alto','medio_alto','medio','baixo') NOT NULL,
	`commission_percent` decimal(5,2) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commission_matrix_id` PRIMARY KEY(`id`)
);

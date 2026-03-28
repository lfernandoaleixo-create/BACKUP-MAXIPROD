CREATE TABLE `pickup_schedule` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedido` varchar(20) NOT NULL,
	`pickupDate` varchar(10) NOT NULL,
	`pickupHour` int NOT NULL,
	`updatedBy` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pickup_schedule_id` PRIMARY KEY(`id`),
	CONSTRAINT `pickup_schedule_pedido_unique` UNIQUE(`pedido`)
);

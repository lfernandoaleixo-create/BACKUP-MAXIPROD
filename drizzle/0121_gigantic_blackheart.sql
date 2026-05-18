CREATE TABLE `payment_calendar_ticks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`maxiprod_id` bigint NOT NULL,
	`ticked_by` varchar(100) NOT NULL,
	`ticked_at` bigint NOT NULL,
	CONSTRAINT `payment_calendar_ticks_id` PRIMARY KEY(`id`)
);

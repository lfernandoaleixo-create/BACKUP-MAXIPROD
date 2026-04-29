CREATE TABLE `payment_priority_marks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fornecedor` varchar(500) NOT NULL,
	`date` varchar(10) NOT NULL,
	`marked_by` varchar(100) NOT NULL,
	`marked_at` bigint NOT NULL,
	CONSTRAINT `payment_priority_marks_id` PRIMARY KEY(`id`)
);

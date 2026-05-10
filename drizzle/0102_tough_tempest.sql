CREATE TABLE `seller_admissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerName` varchar(100) NOT NULL,
	`admissionDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seller_admissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `seller_admissions_sellerName_unique` UNIQUE(`sellerName`)
);

CREATE TABLE `ecommerce_daily_sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`saleDate` timestamp NOT NULL,
	`numberOfSales` int NOT NULL,
	`totalValue` decimal(12,2) NOT NULL,
	`notes` text,
	`createdBy` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ecommerce_daily_sales_id` PRIMARY KEY(`id`)
);

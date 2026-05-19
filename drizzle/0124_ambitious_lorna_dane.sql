CREATE TABLE `catalogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`url` varchar(500) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `catalogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seller_catalog_visibility` (
	`id` int AUTO_INCREMENT NOT NULL,
	`seller_id` int NOT NULL,
	`catalog_id` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seller_catalog_visibility_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seller_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`seller_name` varchar(200) NOT NULL,
	`gestor_name` varchar(200) NOT NULL,
	`password` varchar(100) NOT NULL,
	`authorized` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `seller_permissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seller_product_visibility` (
	`id` int AUTO_INCREMENT NOT NULL,
	`seller_id` int NOT NULL,
	`product_code` varchar(100) NOT NULL,
	`visible` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seller_product_visibility_id` PRIMARY KEY(`id`)
);

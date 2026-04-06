CREATE TABLE `auth_completion` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(10) NOT NULL,
	`completed` boolean NOT NULL DEFAULT false,
	`completedBy` varchar(200),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_completion_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_completion_date_unique` UNIQUE(`date`)
);

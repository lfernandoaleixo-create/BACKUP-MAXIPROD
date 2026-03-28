CREATE TABLE `system_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(50) NOT NULL,
	`title` varchar(300) NOT NULL,
	`message` text NOT NULL,
	`severity` enum('info','warning','error','success') NOT NULL DEFAULT 'info',
	`metadata` json,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `system_notifications_id` PRIMARY KEY(`id`)
);

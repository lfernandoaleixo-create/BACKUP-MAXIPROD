CREATE TABLE `operator_granular_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`operatorId` int NOT NULL,
	`permissionKey` varchar(80) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	CONSTRAINT `operator_granular_permissions_id` PRIMARY KEY(`id`)
);

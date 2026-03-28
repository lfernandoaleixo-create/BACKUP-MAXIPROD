ALTER TABLE `payment_authorizations` ADD `status` enum('autorizado','nao_autorizado','autorizado_ressalva','prorrogar','outros') DEFAULT 'autorizado' NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_authorizations` ADD `createdAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_authorizations` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `payment_authorizations` DROP COLUMN `authorized`;--> statement-breakpoint
ALTER TABLE `payment_authorizations` DROP COLUMN `authorizedAt`;
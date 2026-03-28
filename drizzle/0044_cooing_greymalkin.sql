ALTER TABLE `production_acceptance` ADD `wasModified` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `production_acceptance` ADD `modifiedAt` timestamp;
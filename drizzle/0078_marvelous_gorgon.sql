ALTER TABLE `collection_manual_tick_history` ADD `reason` varchar(200);--> statement-breakpoint
ALTER TABLE `collection_manual_ticks` ADD `tick_status` varchar(20) DEFAULT 'green';
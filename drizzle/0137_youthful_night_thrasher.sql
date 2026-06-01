ALTER TABLE `import_payments` ADD `alert_days_before` int;--> statement-breakpoint
ALTER TABLE `import_payments` ADD `alert_dismissed` boolean DEFAULT false NOT NULL;
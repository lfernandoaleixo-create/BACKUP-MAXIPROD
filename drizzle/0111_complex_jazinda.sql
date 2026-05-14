CREATE TABLE `expense_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`expense_id` int NOT NULL,
	`file_name` varchar(500) NOT NULL,
	`file_url` text NOT NULL,
	`file_key` varchar(500) NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`file_size` int NOT NULL,
	`uploaded_by` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expense_attachments_id` PRIMARY KEY(`id`)
);

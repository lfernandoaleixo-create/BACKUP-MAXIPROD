CREATE TABLE `spreadsheet_uploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`file_key` varchar(500) NOT NULL,
	`file_url` varchar(1000) NOT NULL,
	`file_size` int,
	`mime_type` varchar(100),
	`uploaded_by` varchar(100) NOT NULL,
	`uploaded_at` bigint NOT NULL,
	CONSTRAINT `spreadsheet_uploads_id` PRIMARY KEY(`id`)
);

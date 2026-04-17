CREATE TABLE `sicoob_card_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`card_key` varchar(50) NOT NULL,
	`operator_name` varchar(100) NOT NULL,
	`message` text NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `sicoob_card_messages_id` PRIMARY KEY(`id`)
);

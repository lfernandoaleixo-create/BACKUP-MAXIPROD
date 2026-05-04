CREATE TABLE `supplier_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierId` int NOT NULL,
	`vendedor` varchar(50) NOT NULL,
	`formaContato` enum('ligacao','email','whatsapp','outra') NOT NULL,
	`formaContatoOutra` text,
	`observacao` text,
	`status` enum('ja_cliente','possivel_cliente','novo_cliente','sem_interesse') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supplier_contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` text NOT NULL,
	`segmento` varchar(100) NOT NULL,
	`estado` varchar(50) NOT NULL,
	`cidade` varchar(100),
	`endereco` text,
	`telefone` text,
	`email` varchar(320),
	`website` text,
	`cnpj` varchar(20),
	`notas` text,
	`confianca` varchar(10),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);

CREATE TABLE `order_cancellations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedido` varchar(20) NOT NULL,
	`cliente` varchar(300),
	`clienteApelido` varchar(200),
	`valorTotalPedido` decimal(18,2),
	`dataEmissao` varchar(50),
	`dataCancelamento` varchar(50) NOT NULL,
	`representante` varchar(200),
	`empresa` varchar(100),
	`estadoConfiguravel` varchar(100),
	`crmSegmento` varchar(100),
	`observacoes` text,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `order_cancellations_id` PRIMARY KEY(`id`)
);

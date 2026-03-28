CREATE TABLE `sales_invoice_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigoItem` varchar(20) NOT NULL,
	`descricao` text NOT NULL,
	`quantidade` decimal(18,5) NOT NULL,
	`quantidadeUnEstoque` decimal(18,5),
	`fatorConversao` decimal(18,5),
	`unidadeMedida` varchar(10),
	`unidadeMedidaEstoque` varchar(10),
	`valorUnitario` decimal(18,5),
	`valorTotal` decimal(18,2),
	`valorTotalComDesconto` decimal(18,2),
	`dataEmissao` varchar(30),
	`codigoGrupo` varchar(10),
	`codigoCFOP` varchar(10),
	`empresaDona` varchar(100),
	`collectedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_invoice_items_id` PRIMARY KEY(`id`)
);

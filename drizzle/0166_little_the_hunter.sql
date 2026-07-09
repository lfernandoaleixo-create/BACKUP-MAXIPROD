ALTER TABLE `sales_order_requests` MODIFY COLUMN `status` enum('pendente','aprovado','rejeitado','processado','simulacao') NOT NULL DEFAULT 'pendente';--> statement-breakpoint
ALTER TABLE `import_payments` ADD `armador` varchar(50);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `possui_redespacho` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `redespacho_cnpj` varchar(20);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `redespacho_razao_social` varchar(300);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `redespacho_cep` varchar(10);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `redespacho_logradouro` varchar(300);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `redespacho_numero` varchar(20);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `redespacho_complemento` varchar(200);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `redespacho_bairro` varchar(200);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `redespacho_cidade` varchar(200);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `redespacho_uf` varchar(2);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `redespacho_telefone` varchar(30);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `endereco_entrega_mesmo` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `entrega_cep` varchar(10);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `entrega_logradouro` varchar(300);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `entrega_numero` varchar(20);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `entrega_complemento` varchar(200);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `entrega_bairro` varchar(200);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `entrega_cidade` varchar(200);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `entrega_uf` varchar(2);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `entrega_telefone` varchar(30);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `operacao_fiscal` varchar(50);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `estado_configuravel` varchar(50);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `forma_pagamento` varchar(50);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `data_entrega_pedido` varchar(20);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `previsao_entrega_pedido` varchar(20);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `nome_contato` varchar(200);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `forma_cobranca` varchar(200);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `fornecedor_atual` varchar(200);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `inscricao_municipal` varchar(30);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `inscricao_suframa` varchar(30);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `situacao_fiscal_especial` varchar(100);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `website` varchar(300);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `limite_credito` varchar(30);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `tabela_precos` varchar(200);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `regiao` varchar(100);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `perfil` varchar(100);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `forma_pedido` varchar(100);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `produtos` text;--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `probabilidade_negocio` varchar(50);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `tamanho` varchar(50);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `atencao` varchar(50);--> statement-breakpoint
ALTER TABLE `sales_order_requests` ADD `situacao_cobranca` varchar(30);--> statement-breakpoint
ALTER TABLE `vendor_clients` ADD `redespacho_cnpj` varchar(20);--> statement-breakpoint
ALTER TABLE `vendor_clients` ADD `redespacho_razao_social` varchar(200);--> statement-breakpoint
ALTER TABLE `vendor_clients` ADD `endereco_entrega_mesmo` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `vendor_clients` ADD `entrega_cep` varchar(10);--> statement-breakpoint
ALTER TABLE `vendor_clients` ADD `entrega_logradouro` varchar(300);--> statement-breakpoint
ALTER TABLE `vendor_clients` ADD `entrega_numero` varchar(20);--> statement-breakpoint
ALTER TABLE `vendor_clients` ADD `entrega_complemento` varchar(200);--> statement-breakpoint
ALTER TABLE `vendor_clients` ADD `entrega_bairro` varchar(200);--> statement-breakpoint
ALTER TABLE `vendor_clients` ADD `entrega_cidade` varchar(200);--> statement-breakpoint
ALTER TABLE `vendor_clients` ADD `entrega_uf` varchar(2);--> statement-breakpoint
ALTER TABLE `vendor_clients` ADD `entrega_telefone` varchar(30);--> statement-breakpoint
ALTER TABLE `vendor_clients` ADD `maxiprod_id` bigint;--> statement-breakpoint
ALTER TABLE `vendor_clients` ADD `source` varchar(20) DEFAULT 'manual';
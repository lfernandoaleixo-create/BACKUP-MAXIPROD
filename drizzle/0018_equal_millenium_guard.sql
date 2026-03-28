ALTER TABLE `product_pricing` RENAME COLUMN `estoque_regulador` TO `venda_mensal`;--> statement-breakpoint
ALTER TABLE `product_pricing` ADD `fator_multiplicacao` decimal(5,2);
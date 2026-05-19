# MODELO DE PEDIDO DE VENDA - Especificação

## Fluxo Completo

1. **Vendedor preenche pedido** no app (SellerApp) com:
   - Dados do cliente (com autocomplete para clientes existentes - digita o nome e preenche automático)
   - Produtos com quantidade e preço unitário
   - Condição de pagamento
   - Frete (valor e tipo)
   - Observações

2. **Validação automática**: sistema compara preço de venda com preço mínimo estipulado pelo gestor
   - Se preço >= mínimo: pedido vai direto como **APROVADO**
   - Se preço < mínimo: pedido fica **PENDENTE** com alerta para o gestor

3. **Gestor avalia** pedidos pendentes:
   - Pode **aprovar** (libera para Vitória)
   - Pode **rejeitar** (com motivo)

4. **Vitória processa** pedidos aprovados:
   - Digita o pedido no Maxiprod
   - Marca como **PROCESSADO** (opcionalmente com número do pedido Maxiprod)

## Campos do Formulário (baseado no cadastro Maxiprod)

### Dados do Cliente
- CNPJ/CPF (obrigatório)
- Razão Social (obrigatório)
- Nome Fantasia
- Inscrição Estadual
- Tipo Contribuinte (Contribuinte/Isento)
- Regime Tributário (Normal/Simples Nacional)
- Email para envio de NF-e
- CNAE Fiscal

### Endereço
- CEP
- Endereço (rua)
- Número
- Complemento
- Bairro
- Município
- UF
- Telefone 1 e 2
- Email de contato

### Dados de Venda
- Segmento (Distribuidora, Varejo, etc.)
- Condição de Pagamento
- Valor do Frete
- Tipo de Frete (CIF/FOB)
- Observações

### Itens do Pedido
- Código do item
- Descrição
- Quantidade
- Unidade de medida
- Preço unitário (validado contra preço mínimo)

## Tabelas no Banco

- `product_min_prices` - Preços mínimos por produto (gestor cadastra)
- `sales_order_requests` - Pedidos de venda (dados do cliente + totais + status)
- `sales_order_request_items` - Itens de cada pedido

## Status do Pedido

- `pendente` - Preço abaixo do mínimo, aguardando aprovação do gestor
- `aprovado` - Liberado para a Vitória processar no Maxiprod
- `rejeitado` - Gestor rejeitou (com motivo)
- `processado` - Vitória digitou no Maxiprod

## Pendências Futuras

- Cadastro de preços mínimos pelo gestor (interface de gestão)
- Notificação push para o gestor quando pedido pendente chega
- Histórico de pedidos por vendedor
- Relatório de vendas por vendedor

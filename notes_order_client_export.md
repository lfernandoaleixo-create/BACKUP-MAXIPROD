# Implementation Notes: Order Client Data + Export

## Current State

### Backend (salesOrderRouter.ts)
- `searchClients` (lines 27-279): Returns basic fields only from vendor_clients:
  - cnpjCpf, razaoSocial, nomeFantasia, inscricaoEstadual, tipoContribuinte, regimeTributario
  - emailNfe, cnaeFiscal, cep, endereco, numero, complemento, bairro, municipio, uf
  - telefone1, telefone2, emailContato, segmento, vendorClientId
  - **MISSING**: possuiRedespacho, redespachoCnpj, redespachoRazaoSocial, redespachoCep, redespachoLogradouro, redespachoNumero, redespachoComplemento, redespachoBairro, redespachoCidade, redespachoUf, redespachoTelefone
  - **MISSING**: enderecoEntregaMesmo, entregaCep, entregaLogradouro, entregaNumero, entregaComplemento, entregaBairro, entregaCidade, entregaUf, entregaTelefone

### Frontend (VendedorDetalhe.tsx)
- `NewOrderInline` state (lines 3859-3879): Only basic client fields
- `selectClient` (lines 3965-3990): Only hydrates basic fields
- No redespacho or delivery address state/UI in the order form

### DB Schema (drizzle/schema.ts lines 2281-2333)
- vendor_clients already has ALL the fields needed:
  - possuiRedespacho, redespachoCnpj, redespachoRazaoSocial, redespachoCep/Logradouro/Numero/Complemento/Bairro/Cidade/Uf/Telefone
  - enderecoEntregaMesmo, entregaCep/Logradouro/Numero/Complemento/Bairro/Cidade/Uf/Telefone
  - Also: formaCobranca, condicaoPagamento, fornecedorAtual, observacoes, nomeContato, etc.

## Plan

### Step 1: Extend searchClients to return ALL vendor_client fields
Add to the vcRows.map: possuiRedespacho, all redespacho* fields, enderecoEntregaMesmo, all entrega* fields, formaCobranca, condicaoPagamento, nomeContato, observacoes

### Step 2: Add state + hydration in NewOrderInline
Add state vars for redespacho and entrega fields
Update selectClient to hydrate them

### Step 3: Show redespacho/entrega info in the order review/summary
Display in the "revisao" step so Vitória sees everything

### Step 4: Export CSV/XLS
Create endpoint that generates a CSV/XLSX file with all client + order data in Maxiprod import format
Add download button in the order summary/review step

## Maxiprod Import Format (from test file cnpjDuplicate.test.ts)
- Filename: Maxiprod_<razaoSocial>_<date>.xlsx
- Fields needed: all client data + order items + payment conditions

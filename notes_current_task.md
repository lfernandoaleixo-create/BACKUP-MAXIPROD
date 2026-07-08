# Current Task Notes

## What's done:
1. ManualClientRow (card Clientes Cadastrados) - DONE: Now shows "Possui Redespacho: Sim/Não" and "Endereço de entrega é o mesmo do cadastro: Sim/Não" always visible

## What's remaining:
2. NewOrderInline (Pedido de Venda) - when client is selected from search, need to show redespacho/entrega toggle buttons (Sim/Não) just like in NewClientForm
   - The state variables already exist: possuiRedespacho, redespachoCnpj, redespachoRazaoSocial, etc.
   - Need to add the toggle UI AFTER the client fields (after Segmento field)
   - The selectClient function already hydrates these fields from the client data

## Key locations:
- ManualClientRow: line ~3075 in VendedorDetalhe.tsx
- NewOrderInline: starts around line 3800+ in VendedorDetalhe.tsx
- The client form fields in NewOrderInline end around the Segmento field
- Need to find where the form fields end and add redespacho/entrega toggles there

## Also need to fix:
- VitoriaOrders.tsx (line ~450): Remove "Contribuinte ICMS" and "Inscrição Estadual" from the order detail view
- VitoriaOrders.tsx: Add redespacho and entrega sections to the order detail view
- The order data already has possuiRedespacho, redespachoCnpj, etc. fields from salesOrderRouter.ts

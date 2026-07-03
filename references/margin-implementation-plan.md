# Margin Bar Implementation Plan

## Key Data Points

### Order Data (sales_order_requests table):
- `totalProdutos` / `totalPedido` - valor da venda
- `uf` - UF do cliente (para ICMS + DIFAL)
- `tipoContribuinte` - Contribuinte/Não contribuinte (para DIFAL)
- `cep` - CEP do cliente (para cotação de frete)
- `cnpjCpf` - CNPJ do cliente (para cotação de frete)
- Items have: `codigoItem`, `quantidade`, `precoUnitario`, `totalItem`

### Product Cost (from importRouter.getRealTimeCosts):
- Returns array with: `codigoItem`, `custoReal`, `custoProjetado` (orange), `custoEstimativa`
- `custoProjetado` is the "coluna alaranjada" Fernando referenced
- Keyed by `codigoItem` - same code used in order items
- Uses `valorCaixaBrl` from import_po_products

### Quarterly Revenue (for IRPJ):
- From `sales_orders` table: sum `valorTotal` where `dataEmissao` is in current quarter
- Or sum `valorTotalPedido` (distinct by pedido) for unique orders

### Braspress API:
- POST https://api.braspress.com/v1/cotacao/calcular/json
- Basic Auth: Base64(usuario:senha)
- 3 CNPJs with credentials (stored in braspressApi.ts)
- Needs: cepOrigem, cepDestino, peso, volumes, cubagem, vlrMercadoria, cnpjDestinatario

### Where to add margin calculation:
- New procedure in salesOrderRouter: `calculateMargin`
- Called AFTER order is closed (processado/lançado)
- Frontend: VitoriaOrders.tsx is the best place to show margin bar

### Tax Calculation Engine (already created):
- File: server/taxCalculation.ts
- Functions: calcularImpostos(input) → TaxBreakdown, calcularMargem(input) → MarginResult
- All rules from Fernando implemented

### Braspress Integration (already created):
- File: server/braspressApi.ts
- Functions: cotarBraspress(input), cotarTodosCnpjs(input)
- 3 CNPJ credentials hardcoded (per Fernando's instruction)

## Next Steps:
1. Add `calculateMargin` and `quoteBraspress` procedures to salesOrderRouter
2. Procedure needs to:
   - Get order data (valor, UF, tipoContribuinte, items)
   - Get product costs from import PO data (custoProjetado/custoReal)
   - Calculate quarterly revenue for IRPJ
   - Calculate all taxes using taxCalculation.ts
   - Return full margin breakdown
3. Add `quoteBraspress` procedure that calls braspressApi.ts
4. Build UI in VitoriaOrders.tsx (or a new component) showing margin bar after lançamento

## CEP Origem (Grupo Fox):
- Need to determine the CEP of Grupo Fox warehouse
- Likely in Minas Gerais - check from existing order data or ask Fernando

## Product Type (importado vs industrializado):
- Need to determine per-product or per-order
- grupoCodigo '20' or '21' = imported products (from getRealTimeCosts logic)
- Others = industrializado
- Could also check stockItems.procedencia field

## Commission:
- Fernando said "a comissão ainda vou pedir o gestor para preencher no campo devido"
- Need to add a commission field to the order or to the margin calculation UI
- For now, make it an input parameter (gestor fills it in)

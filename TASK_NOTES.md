# Task Notes - Pedido de Venda Improvements

## Phase 1: Estados Configuráveis (line 7174-7183 in VendedorDetalhe.tsx)
- Current options: MADEIRA, BAMBU, AROMAS, ESPETOS, MADEIRA IMPORTADA, MATÉRIA-PRIMA IMPORTADA, EMBALAGENS, PALITOS, DESCARTÁVEIS
- Need to add: MADEIRA CONTABILIZADO, MADEIRA IMPORTAÇÃO, FIBRA, SERRAGEM, ROJÃO, E-COMMERCE, AMOSTRA, BONIFICAÇÃO
- The dropdown is at line 7174 in VendedorDetalhe.tsx

## Phase 1: Client Fields Already Added
- The insert-fields.py script already added client fields (Dados Fiscais, Dados de Venda, Dados de Relacionamento, Cobrança) to the finalization step
- The Maxiprod fields (Operação Fiscal, Natureza, Estado Configurável, Forma Pagamento, Datas) were also moved to the main finalization
- The CustosDeVendaStep had its "Dados para Maxiprod" section removed (replaced with a note)

## Phase 2: Export (server/maxiprodOrderExport.ts)
- generateMaxiprodOrderExcel already handles dates in columns T (Entrega) and U (Previsão entrega)
- generateMaxiprodOrderExcelFromDb (line 381) reads dataEntrega and previsaoEntrega from DB
- The dates ARE being passed from frontend (lines 5503-5504 and 5601-5602 in VendedorDetalhe.tsx)
- The issue Fernando reported may be that dates weren't filled in the old location (CustosDeVendaStep)
- Now that dates are in the main finalization, they should work correctly

## Phase 3: Frete Separation
- Currently frete is likely being summed with order total in the revision step
- Need to find where the total is calculated in the revision step and separate frete
- Export should NOT include frete in the order value (column Q is already null in export)

## Phase 4: New Permissions
- Add "Custos de Venda" to GRANULAR_GC_FEATURES in SettingsPage.tsx (around line 620-634)
- Pattern: { key: "gc.custosDeVenda", label: "Custos de Venda", parentTab: "gestao-comercial" }

## Phase 5: Audit Items
- Permissions: check SettingsPage.tsx granular permissions flow
- Stock visibility: check SellerStockView component
- Price tables: check TabelaPrecosView component
- Search: check product search in order flow
- Reload bug: check stock liberation flow in GestaoComercial.tsx

## Key File Locations
- VendedorDetalhe.tsx: Main seller detail page (8572 lines)
- CustosDeVendaStep.tsx: Cost of sale step component
- maxiprodOrderExport.ts: Maxiprod export function
- salesOrderRouter.ts: Order creation/export endpoints
- SettingsPage.tsx: Settings/permissions page
- GestaoComercial.tsx: Gestão Comercial main page

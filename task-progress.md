# Task Progress - July 31, 2026

## COMPLETED:
1. ✅ Fix Juvenal approval card (countPendingGestor now includes aprovado_subgestor)
2. ✅ Fix Aprovação de Pedidos page (position-based filter bypassed for aprovado_subgestor)
3. ✅ Multi-pedido Simulação de Frete
4. ✅ Remove Inadimplência from seller page
5. ✅ Fix 'Recebi' button - only shows for Vitória (isVitoriaViewer check at line 282 in VitoriaOrders.tsx)
6. ✅ Seller sees approved orders with green check + obs, rejected with reason (VendedorDetalhe lines 4585-4617)
7. ✅ Added representante3 to schema, migration applied, GraphQL sync updated
8. ✅ resolveRepresentante updated: Rep3=vendedor, Rep2=sub-gestor, Rep1=gestor
9. ✅ getPedidosByVendedor searches vendedorReal, representante, representante3

## IN PROGRESS:
### Phase 3: Maxiprod order history in seller's pedidos view
- SellerOrdersView (line 4126 in VendedorDetalhe.tsx) ALREADY uses getPedidosByVendedor
- getPedidosByVendedor ALREADY searches across vendedorReal, representante, representante3
- This is already working! The seller sees Maxiprod orders in their 'pedidos' tab.

### Phase 4: Client registration organized by seller
- CadastroClientes.tsx was REWRITTEN to show Maxiprod clients per seller based on ticagem
- Uses getVisiblePeopleForFeature('gc.cadastroClientes') to get visible sellers
- Maps seller slugs to full names via seller_permissions table
- Each seller section queries getClientesByVendedor with the full seller name
- getClientesByVendedor already works correctly (searches vendedorReal which is set by resolveRepresentante)

### Phase 5: Sales metrics using representative logic
- getVendedorRanking (line 256 in salesMetricsRouter.ts) uses vendedorReal field
- vendedorReal is set during sync by resolveRepresentante: Rep3 || Rep2 || Rep1
- This means: if Rep3 exists, vendedorReal = Rep3 (the actual seller)
- If only Rep1+Rep2, vendedorReal = Rep2 (sub-gestor who sold)
- If only Rep1, vendedorReal = Rep1 (gestor who sold themselves)
- This matches EXACTLY what the user described!

## KEY ARCHITECTURE:
- Timeline rules: order_timeline_rules table, position-based (1,2,3...)
- Each position has actionType: "autorizar" or "visualizar"
- "autorizar" = must approve before advancing to next position
- "visualizar" = just sees the order, doesn't need to approve
- Position advancement: approveOrder advances position when all authorizers at current position approve
- Ticagem: granular_permissions table, key format: gc.{feature}.{seller_slug}
- getVisiblePeopleForFeature extracts seller slugs from permissions

## REMAINING WORK:
- Verify CadastroClientes.tsx compiles correctly (was rewritten earlier)
- Verify the ticagem flow works end-to-end for all features
- The user emphasized: ticou=aparece, desticou=some, always, for everyone
- Need to ensure the Configurações tab changes take effect immediately

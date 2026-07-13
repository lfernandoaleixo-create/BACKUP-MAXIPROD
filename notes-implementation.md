# Implementation Notes - Remaining Tasks

## COMPLETED (this session):
1. Backend: updateOrder mutation in salesOrderRouter.ts (end of file ~line 2768+)
2. Frontend: editOrderId state, Pencil edit button for pending orders in VendedorDetalhe.tsx
3. Frontend: NewOrderInline accepts editOrderId prop
4. Frontend: useEffect to prefill form from order data when editing
5. Frontend: doSubmitOrder calls updateOrderMutation when isEditMode

## STILL NEEDED:

### Task 2: Notify gestor when order arrives
- notificationRouter.ts line 30: PEDIDO_VENDEDOR_OPERATORS = ['Juvenal', 'Vitória', 'Vitoria', 'Guilherme']
- Need to add 'Renato' to this list so he gets notified
- The notification already fires in createOrder (salesOrderRouter.ts ~lines 879-928)
- The notification metadata already includes gestorName
- Could also add filtering in notificationRouter.ts to show gestor-specific notifications

### Task 3: Renato and Juvenal - both gestor AND vendedor panels
- OperatorContext.tsx lines 112-126: hasAccess('gestao-comercial') only allows Fernando, Guilherme, Juvenal, Vitória, Luis Eduardo
- Need to add 'Renato' to that access list
- GestaoComercial.tsx line 157: showNavigationHub condition - need to add Renato
- Also need to ensure the VendedorGestor (seller app) is accessible to Renato and Juvenal
  - The seller app at /vendedor-gestor uses window.location.pathname check in App.tsx
  - It renders SellerApp which shows seller list - Renato/Juvenal can already access it as gestors
  - The hub navigation card "Painel dos Vendedores" links to /vendedor-gestor via <a> tag (full page nav)
  - So the key fix is just making sure Renato can access the gestao-comercial section

### Also: showRealCostBar in VendedorDetalhe.tsx line 4328
- Currently: Guilherme, Fernando, Juvenal, Bruno
- Need to add Renato so he can see the margin/reputation bar too

## KEY FILE LOCATIONS:
- notificationRouter.ts: PEDIDO_VENDEDOR_OPERATORS at line 30
- OperatorContext.tsx: hasAccess('gestao-comercial') at lines 112-126
- GestaoComercial.tsx: showNavigationHub at line ~157
- VendedorDetalhe.tsx: showRealCostBar at line ~4328 (now shifted due to edits)

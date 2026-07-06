# Implementation Plan: CNPJ Update Flow + Maxiprod Export for Vitória

## Current State

### Backend (salesRouter.ts)
- `createVendorClient` (line 3743): Currently throws TRPCError CONFLICT when CNPJ exists
  - Already queries existing client: id, razaoSocial, cnpjCpf, sellerName
- `updateVendorClient` (line 3895): Accepts id + partial fields (basic set only)
  - Needs to be expanded to accept ALL fields from createVendorClient

### Frontend (VendedorDetalhe.tsx)
- `NewClientForm` component (line 2195): Full form with all fields
- Error handling (line 2348-2349): Catches error and shows in `setError()`
- Need to: Instead of just showing error, show a confirmation dialog asking if they want to edit

### Vitória Panel (VitoriaOrders.tsx)
- Shows expanded order details with client info sections (lines 334-499)
- Action buttons at lines 502-547 (Recebido / Lançado)
- `getOrdersForOperator` (salesOrderRouter.ts line 724): Returns full order data from sales_order_requests

### Database (schema.ts)
- `sales_order_requests`: Has all client fields copied into the order
- `vendor_clients`: Has `updatedAt` timestamp but no `updatedBy` or modification tracking field
- Need to add: `lastModifiedBy` field to vendor_clients to track who modified it

## Plan

### Phase 1: CNPJ Duplicate → Ask to Edit
1. Backend: Change `createVendorClient` to return structured error with existing client data (id, all fields)
2. Frontend: Catch CONFLICT error, show dialog: "CNPJ já cadastrado. Deseja fazer alterações cadastrais nesse cliente?"
3. If yes: Pre-fill form with existing data, switch to update mode
4. Backend: Expand `updateVendorClient` to accept ALL fields + add `lastModifiedBy` field

### Phase 2: Maxiprod Export in Vitória Panel
1. Add `vendorClientId` to sales_order_requests (or derive from CNPJ match)
2. Add banner in VitoriaOrders.tsx: "Dados do cliente [X] foram modificados por [vendedor Y]"
3. Add "Exportar Maxiprod" button that calls the existing maxiprodExcelExport.ts
4. Backend endpoint: generate Excel for a specific client by order ID

### Key Files to Edit
- server/salesRouter.ts (createVendorClient, updateVendorClient)
- client/src/pages/VendedorDetalhe.tsx (NewClientForm - add edit mode)
- client/src/pages/VitoriaOrders.tsx (add banner + export button)
- server/salesOrderRouter.ts (add export endpoint or modify getOrdersForOperator)
- drizzle/schema.ts (add lastModifiedBy to vendor_clients)

# Implementation Context Notes (30/07/2026)

## SSW Web Protocol Automation (Camilo)
- **Credentials**: Domínio: RCS, Usuário: foxp, Senha: 2010
- **Login endpoint**: POST to `https://sistema.ssw.inf.br/bin/ssw0422` with `X-Requested-With: XMLHttpRequest` header
- **Quotation form**: GET `https://sistema.ssw.inf.br/bin/ssw1608` (after login, with session cookies)
- **Submit quotation**: POST to `/bin/ssw1608` with `act=ENV` and form fields:
  - f2=CNPJ pagador, f4=mercadoria type, f6=CEP origem, f8=CEP destino
  - f9=tipo frete (1=CIF, 2=FOB), f15=valor NF, f16=qtd volumes, f18=peso, cubagem=cubagem
- **Response**: XML with `<dado>` elements; nro_cotacao is in element with id="nro_cotacao"
- **Implementation**: `getSSWWebProtocol()` function in `server/sswApi.ts`
- **Called by**: `quoteAllSswCnpjsWithProtocol()` which first does SOAP quote, then gets protocol via web

## Sequential Approval Order System
- **Schema changes**:
  - `order_timeline_rules.approval_position` (INT, default 1) - position in approval chain
  - `sales_order_requests.current_approval_position` (INT, default 1) - tracks which position the order is at
- **Condition type**: `apos_aprovacao_gestores` - recipient only sees orders after all gestors approve
- **Backend logic** (in `salesOrderRouter.ts` approveOrder):
  - When a gestor approves, checks if ALL recipients at current position have approved
  - If yes, advances `currentApprovalPosition` to next position
  - If no more positions with "autorizar" action, marks order as fully approved
- **Frontend** (`OrderTimelineConfig.tsx`):
  - Position selector (1-5 buttons) for each recipient
  - "Após aprovação dos gestores" condition option in the conditions list
- **Filtering** (listOrders):
  - When `recipientName` is provided, filters orders based on the recipient's position in timeline rules
  - Recipients with `apos_aprovacao_gestores` only see orders with status "aprovado" or "processado"

## Simulação de Frete Card
- **Location**: Gestão Comercial tab, with permission toggle in Settings → GC
- **Permission key**: `simulacaoFrete`
- **Route**: `/gestao-comercial/simulacao-frete`
- **Flow**: User enters pedido number → fetches from Maxiprod → simulates freight with all 5 carriers
- **Carriers**: Rodonaves, Braspress, Alfa, Flor de Minas, Camilo (with protocol via SSW web)

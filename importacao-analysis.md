# Análise da Planilha PAGAMENTOS IMPORTAÇÃO

## Estrutura

4 abas (fornecedores):
1. BETTY (BAMBU)
2. WINNIE - HARBIN (MADEIRA)
3. HANK - CARRY (BAMBU)
4. BANNY (MÁQUINAS)

## Colunas (iguais em todas as abas):
1. STATUS - ex: "Doc ok - navegando", "Produção", "Aguardando Pagamento", "Navegando - Falta Cert. Fumigação"
2. PEDIDO - código do pedido (PO062, ZYZ2026-018, etc.)
3. DOC - tipo de documento (CI = Commercial Invoice, PI = Proforma Invoice)
4. TOTAL USD - valor total em dólares
5. 0.5 (50%) - metade do total (split Brasil/Paraguai)
6. BRASIL USD - valor pago via Brasil
7. PARAGUAI USD - valor pago via Paraguai
8. TOTAL PAGO - soma dos pagamentos
9. SALDO DEVEDOR BRASIL - quanto falta pagar via Brasil
10. SALDO DEVEDOR PARAGUAI - quanto falta pagar via Paraguai
11. SALDO DEVEDOR TOTAL - total que falta pagar
12. RASTREIO - código de rastreio do container

## Dados existentes:
- BETTY: 2 pedidos (PO062, 01PH202603) - total USD 52,038.51
- HARBIN: 5 pedidos - total USD 213,500
- HANK CARRY: 1 pedido (PCIE202601) - total USD 23,170
- BANNY: vazia (só cabeçalho copiado)

## Lógica:
- Cada pedido tem um total USD
- 50% é a referência de split
- Pagamentos podem ser feitos via Brasil ou Paraguai
- Total Pago = Brasil USD + Paraguai USD
- Saldo Devedor = Total USD - Total Pago (dividido entre Brasil e Paraguai)

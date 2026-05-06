# Dark Mode Fixes Notes

## Issues from screenshots:

1. **Estoque tab** (IMAGE160200): Cards look fine with dark bg. PO card at bottom has dark bg already. OK.
2. **Madeira cards** (IMAGE160248): "Madeira Aguardando Escolha" - text wraps. The icon and "16 itens" badge are on separate line from title.
3. **Vendas - Evolução Diária chart** (IMAGE160304): Cards "MÉDIA DIÁRIA DO MÊS ANTERIOR" and "MÉDIA DIÁRIA DO MELHOR MÊS" have WHITE/LIGHT backgrounds. Need dark bg + golden text. The chart bars are gray/dark - need golden color.
4. **Faturamento tables** (IMAGE160308, 160313): Tables have columns overlapping "CUEnte" text merged with "Emissão". Need horizontal scroll. Text is cut at "Entrega..."
5. **A FATURAR ANTERIOR** (IMAGE160322): This is in LIGHT MODE (note the light bg). Not a dark mode issue.
6. **Inadimplência** (IMAGE160326): In LIGHT MODE. Shows the inadimplência section correctly.
7. **Produção** (IMAGE160430): Dark mode looks OK. Bolinha "3" is yellow/gold bg - user says it's white. Need to check.
8. **Login logo** (IMAGE160450): Logo has WHITE background rectangle behind it. Need to remove white bg and make text/fox golden.
9. **Configurações** (IMAGE160525): Checkboxes lost their colors - all appear as dark squares without visible check marks. Need to restore colored checkmarks.
10. **Financeiro - Resumo** (IMAGE160527, 160542): "RESUMO FINANCEIRO" card has WHITE/LIGHT background. Need dark bg.
11. **Inadimplência alert** (IMAGE160530): Orange alert card has LIGHT/BEIGE bg. Need dark bg + golden text.
12. **Total Consolidado** (IMAGE160533): Card has WHITE/LIGHT bg. Need dark bg.
13. **Autorização pagamentos** (IMAGE160539): Cards for each fornecedor (ALFA TRANSPORTES, ARTES DO PINGUIM, etc.) are all dark/black with no visual division. When NOT all checked → golden neon border. When ALL checked → green neon border.

## Key CSS classes to target in dark mode:
- `bg-white` → dark bg
- `bg-slate-50` → dark bg  
- `bg-amber-50` → dark bg with golden neon border
- `bg-emerald-50` → dark bg with green neon border
- Chart bars: change from gray to golden
- Chart text labels: change from dark to white/golden
- Logo: remove white bg, make golden

## Components to modify:
- `client/src/index.css` - global dark overrides
- `client/src/pages/Sales.tsx` - chart colors
- `client/src/components/WeekReconciliationCard.tsx` - authorization cards
- `client/src/components/LoginScreen.tsx` - logo bg
- Various billing/faturamento tables - overflow-x scroll

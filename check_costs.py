import json, sys, urllib.request

url = "http://localhost:3000/api/trpc/import.getRealTimeCosts"
resp = urllib.request.urlopen(url)
data = json.loads(resp.read())
result = data.get("result", {}).get("data", {}).get("json", [])

print(f"Total products with cost data: {len(result)}")
print("=" * 80)

for item in result[:10]:
    print(f"\n{item['codigoItem']} - {item['descricao'][:50]}")
    print(f"  Estoque: {item['caixasEstoque']} caixas")
    print(f"  Custo Real: R$ {item['custoReal']} | Custo Projetado: R$ {item['custoProjetado']}")
    print(f"  Sem estoque: {item['semEstoque']} | Tem navegando: {item['temNavegando']}")
    if item.get('breakdownReal'):
        print(f"  Breakdown Real (FIFO):")
        for b in item['breakdownReal']:
            print(f"    {b['poNumber']}: {b['caixasUsadas']} caixas @ R$ {b['valorCaixa']:.4f}")
    if item.get('breakdownProjetado'):
        print(f"  Breakdown Projetado:")
        for b in item['breakdownProjetado']:
            print(f"    {b['poNumber']}: {b['caixasUsadas']} caixas @ R$ {b['valorCaixa']:.4f}")

# Check if FIFO ordering is working (need dates)
print("\n\n" + "=" * 80)
print("SUMMARY:")
print(f"  Products with custo real > 0: {sum(1 for i in result if i['custoReal'] > 0)}")
print(f"  Products with custo projetado > 0: {sum(1 for i in result if i['custoProjetado'] > 0)}")
print(f"  Products sem estoque: {sum(1 for i in result if i['semEstoque'])}")
print(f"  Products with multiple POs in breakdown: {sum(1 for i in result if len(i.get('breakdownReal', [])) > 1)}")

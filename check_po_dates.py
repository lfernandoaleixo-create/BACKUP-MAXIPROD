import json, urllib.request, urllib.parse

# Get POs for supplier 120002 (BETTY - FUSHENG with 42 POs)
sid = 120002
# tRPC uses superjson encoding for input
encoded_input = urllib.parse.quote(json.dumps({"json": {"supplierId": sid}}))
url = f"http://localhost:3000/api/trpc/import.getPosBySupplier?input={encoded_input}"
resp = urllib.request.urlopen(url)
data = json.loads(resp.read())
pos = data.get("result", {}).get("data", {}).get("json", [])
print(f"POs for supplier {sid}: {len(pos)}")

# Sort by date
pos_sorted = sorted(pos, key=lambda x: x.get('previsaoEntrega') or '9999')
print("\nAll POs sorted by previsaoEntrega:")
for po in pos_sorted:
    date = po.get('previsaoEntrega', 'SEM DATA')
    status = po.get('navigationStatus', '?')
    print(f"  {po['poNumber']:6s} | {date:20s} | {status}")

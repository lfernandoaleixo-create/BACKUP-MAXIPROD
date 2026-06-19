import json, urllib.request, urllib.parse

# Check what the getPoProducts endpoint returns for PO65
# First find the PO ID for PO65
sid = 120002
encoded_input = urllib.parse.quote(json.dumps({"json": {"supplierId": sid}}))
url = f"http://localhost:3000/api/trpc/import.getPosBySupplier?input={encoded_input}"
resp = urllib.request.urlopen(url)
data = json.loads(resp.read())
pos = data.get("result", {}).get("data", {}).get("json", [])

po65 = next((p for p in pos if p['poNumber'] == 'PO65'), None)
if po65:
    po_id = po65['id']
    print(f"PO65 ID: {po_id}")
    
    # Get products for this PO
    encoded_input2 = urllib.parse.quote(json.dumps({"json": {"poId": po_id}}))
    url2 = f"http://localhost:3000/api/trpc/import.getPoProducts?input={encoded_input2}"
    try:
        resp2 = urllib.request.urlopen(url2)
        data2 = json.loads(resp2.read())
        products = data2.get("result", {}).get("data", {}).get("json", [])
        print(f"Products in PO65: {len(products)}")
        for p in products:
            print(f"  {p.get('productCode', 'NO CODE'):8s} | {p.get('description', '')[:40]:40s} | qty={p.get('quantidade')} | R${p.get('valorCaixaBrl', 0)}")
    except Exception as e:
        print(f"Error: {e}")
else:
    print("PO65 not found")

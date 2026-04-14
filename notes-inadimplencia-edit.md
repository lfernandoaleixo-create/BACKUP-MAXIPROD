# InadimplenciaTab Edit Plan

## Key locations:
- Line 10: import CobrancaGuideSimulator
- Line 13: COBRANCA_GUIDE_OPERATORS = ["Flavio", "Thiago", "Guilherme", "Fernando", "Bruno"]
- Line 140: showCobrancaGuide state
- Line 141: canSeeCobrancaGuide check

## Edits needed:

### 1. Add import for DecisaoCobrancaTutorial (after line 10)
```
import DecisaoCobrancaTutorial from "@/components/DecisaoCobrancaTutorial";
```

### 2. Add state for tutorial (after line 140)
```
const [decisaoTutorialData, setDecisaoTutorialData] = useState<{clienteName: string; vendedorName: string} | null>(null);
```

### 3. Compute missing decisao count for Vitória alert (after line 301)
- Count titles where decisaoCobranca is empty/null
- Only show alert when operator is "Vitoria"

### 4. Add Vitória alert banner (after line 475, after the header div closes)
- Show a prominent amber/red banner when operator is Vitoria
- Show count of titles without decisaoCobranca
- Include eye icon button to open tutorial

### 5. Replace the empty "—" in decisaoCobranca cells (lines 952-953 and 1110-1111)
- When decisaoCobranca is empty, show a clickable warning icon that opens the tutorial
- Pass clienteName and vendedorName to the tutorial

### 6. Add DecisaoCobrancaTutorial modal (after line 769)
```
{decisaoTutorialData && (
  <DecisaoCobrancaTutorial
    clienteName={decisaoTutorialData.clienteName}
    vendedorName={decisaoTutorialData.vendedorName}
    onClose={() => setDecisaoTutorialData(null)}
  />
)}
```

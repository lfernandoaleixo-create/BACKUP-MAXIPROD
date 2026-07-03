# Regras de Impostos — Grupo Fox

## Alíquotas Internas de ICMS por Estado (2026)

| UF | Alíquota Interna |
|----|-----------------|
| AC | 19% |
| AL | 20% |
| AM | 20% |
| AP | 18% |
| BA | 20,5% |
| CE | 20% |
| DF | 20% |
| ES | 17% |
| GO | 19% |
| MA | 23% |
| MG | 18% |
| MS | 17% |
| MT | 17% |
| PA | 19% |
| PB | 20% |
| PE | 20,5% |
| PI | 22,5% |
| PR | 19,5% |
| RJ | 22% |
| RN | 20% |
| RO | 19,5% |
| RR | 20% |
| RS | 17% |
| SC | 17% |
| SE | 20% |
| SP | 18% |
| TO | 20% |

## ICMS Estadual — Grupo Fox (Origem: MG)

### Produto IMPORTADO (revenda direta com TTS/Corredor de Importação):
- **Interna MG**: Efetiva = **14%** (Destacada NF 18% - Crédito Corredor 4%)
- **Interestadual (qualquer estado)**: Efetiva = **1,5%** (Destacada NF 4% - Crédito Corredor 2,5%)

### Produto INDUSTRIALIZADO:
- **Interna MG**: **18%**
- **Interestadual**: **12%** (para a maioria dos destinos do Grupo Fox)
  - Nota: pela tabela ICMS 2026, MG→maioria = 7%, mas Fernando confirmou que usarão 12%

## Impostos Federais — Efetivos sobre a venda

### PIS e COFINS:
- **Interna MG**: PIS = 0,533% | COFINS = 2,46%
- **Interestadual**: PIS = 0,572% | COFINS = 2,64%

### IRPJ (trimestral):
- Alíquota base: **1,20%**
- Se faturamento trimestral > R$ 1.250.000: alíquota sobe até **2,28%** (adicional)
- Fonte do faturamento: aba Vendas → Evolução Trimestral

### CSLL (trimestral):
- Alíquota: **1,188%** (com nova presunção)

## DIFAL — Diferencial de Alíquotas

### Quando se aplica:
- Vendas **interestaduais** para **não contribuinte** de ICMS
- O **Grupo Fox paga 100%** do DIFAL (desde 2022, sem partilha)
- Se cliente é **contribuinte**, ele que recolhe o DIFAL

### Tipos de cálculo por UF:

#### Cálculo "Simples":
DIFAL = (Alíquota interna destino - Alíquota interestadual) × Valor da operação

#### Cálculo "Por dentro":
Base = Valor da operação / (1 - Alíquota interna destino)
DIFAL = (Base × Alíquota interna destino) - (Valor operação × Alíquota interestadual)

### Configuração DIFAL por UF (Base de cálculo ICMS Dest):

| UF | Base Cálculo | Método |
|----|-------------|--------|
| AC | Simples | ICMS interestadual |
| AL | Simples | ICMS interestadual |
| AM | Simples | ICMS interestadual |
| AP | Simples | ICMS interestadual |
| BA | Simples | ICMS interestadual |
| CE | Simples | ICMS interestadual |
| DF | Simples | ICMS interestadual |
| ES | Simples | ICMS interestadual |
| GO | Por dentro sem descontar ICMS interestadual | ICMS interestadual |
| MA | Simples | ICMS interestadual |
| MG | Por dentro | ICMS interestadual |
| MS | Simples | ICMS interestadual |
| MT | Simples | ICMS interestadual |
| PA | Simples | ICMS interestadual |
| PB | Simples | ICMS interestadual |
| PE | Simples | ICMS interestadual |
| PI | Simples | ICMS interestadual |
| PR | Por dentro | ICMS interestadual |
| RJ | Simples | ICMS interestadual |
| RN | Simples | ICMS interestadual |
| RO | Simples | ICMS interestadual |
| RR | Simples | ICMS interestadual |
| RS | Por dentro | ICMS interestadual |
| SC | Simples | ICMS interestadual |
| SE | Simples | ICMS interestadual |
| SP | Simples | ICMS interestadual |
| TO | Simples | ICMS interestadual |

## Resumo — Carga Tributária Total por Cenário

### Produto Importado - Interna MG:
- ICMS: 14% + PIS: 0,533% + COFINS: 2,46% + IRPJ: 1,20%~2,28% + CSLL: 1,188%
- **Total: ~19,38% a ~20,46%**

### Produto Importado - Interestadual:
- ICMS: 1,5% + PIS: 0,572% + COFINS: 2,64% + IRPJ: 1,20%~2,28% + CSLL: 1,188%
- **Total: ~7,10% a ~8,18%**
- Se não contribuinte: + DIFAL (varia por estado destino)

### Produto Industrializado - Interna MG:
- ICMS: 18% + PIS: 0,533% + COFINS: 2,46% + IRPJ: 1,20%~2,28% + CSLL: 1,188%
- **Total: ~23,38% a ~24,46%**

### Produto Industrializado - Interestadual (12%):
- ICMS: 12% + PIS: 0,572% + COFINS: 2,64% + IRPJ: 1,20%~2,28% + CSLL: 1,188%
- **Total: ~17,60% a ~18,68%**
- Se não contribuinte: + DIFAL (varia por estado destino)

## Regra: Contribuinte vs Não Contribuinte
- **Contribuinte de ICMS**: cliente paga o DIFAL → não impacta margem do Grupo Fox
- **Não Contribuinte**: Grupo Fox paga o DIFAL → desconta do lucro da venda

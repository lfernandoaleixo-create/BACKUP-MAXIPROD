# Cotação de Frete - Expresso Flor de Minas

## Resumo

A cotação da Flor de Minas é baseada em uma **tabela fixa** (não API). Os inputs são:
- **Cidade/Estado** de destino
- **Valor da NF-e** (R$)
- **Peso da mercadoria** (kg)
- **Quantidade de volumes** (fixo em 2 na planilha)

Os outputs são:
- **Valor do Frete** (R$)
- **% do Frete** sobre o valor da NF
- **Prazo de Entrega** (24h ou 48h)

---

## Fórmula de Cálculo do Frete

O frete total é composto por **4 parcelas** somadas:

```
FRETE_TOTAL = VALOR_BASE + SEGURO + PEDÁGIO + TAXA_ENTREGA
```

### 1. VALOR_BASE (I48)

Determinado pela **faixa de peso**:

| Faixa de Peso | REF | Valor Base (C) |
|---|---|---|
| até 50 kg | 1 | R$ 103,03 |
| de 51 a 150 kg | 2 | R$ 160,27 |
| de 151 a 250 kg | 3 | R$ 186,00 |
| acima de 250 kg | 4 | peso × 0,747 |

**Lógica:**
```
SE peso >= 1 E peso <= 50 → REF = 1 → Valor Base = R$ 103,03
SE peso > 50 E peso <= 150 → REF = 2 → Valor Base = R$ 160,27
SE peso > 150 E peso <= 250 → REF = 3 → Valor Base = R$ 186,00
SE peso > 250 → REF = 4 → Valor Base = peso × 0,747
```

A fórmula usa VLOOKUP para buscar o valor base na coluna C baseado no REF:
```
I48 = VLOOKUP(REF, tabela_precos, coluna_C)
```

### 2. SEGURO (I49)

```
SEGURO = valor_nf × taxa_seguro
SEGURO = C15 × 0,007
```

Onde:
- `C15` = Valor da NF-e
- `0,007` = Taxa de seguro (0,7% do valor da NF)

### 3. PEDÁGIO (I50)

```
PEDÁGIO = 1 × R$ 12,30
PEDÁGIO = R$ 12,30 (fixo por volume unitário)
```

O valor do pedágio é fixo: **R$ 12,30** multiplicado por 1 (constante na fórmula).

### 4. TAXA DE ENTREGA (I51)

```
TAXA_ENTREGA = (volumes - 1) × R$ 95,00
```

Onde:
- `volumes` = H47 (quantidade de volumes, padrão = 2)
- A fórmula é: `(H47 - 1) × D51` = `(2 - 1) × 95` = R$ 95,00

**Nota:** Se volumes = 1, a taxa de entrega = R$ 0,00. Se volumes = 3, taxa = R$ 190,00.

---

## Fórmula Completa

```
FRETE = valor_base(peso) + (valor_nf × 0.007) + 12.30 + ((volumes - 1) × 95)
```

### Exemplo com os dados da planilha:
- Cidade: Ribeirão Pires - SP
- Valor NF: R$ 1.000,00
- Peso: 30 kg
- Volumes: 2

```
REF = 1 (peso <= 50)
Valor Base = R$ 103,03
Seguro = 1000 × 0,007 = R$ 7,00
Pedágio = R$ 12,30
Taxa Entrega = (2 - 1) × 95 = R$ 95,00

FRETE TOTAL = 103,03 + 7,00 + 12,30 + 95,00 = R$ 217,33
% do Frete = 217,33 / 1000 = 21,73%
Prazo = 48 horas (via VLOOKUP na tabela de cidades)
```

---

## % do Frete

```
percentual_frete = frete_total / valor_nf
```

---

## Prazo de Entrega

O prazo é determinado por VLOOKUP na tabela de cidades (rows 55-166):
```
PRAZO = VLOOKUP("Cidade - UF", tabela_cidades, coluna_prazo)
```

Valores possíveis: **24 horas** ou **48 horas**

---

## Tabela de Cidades Atendidas (112 cidades)

### São Paulo (39 cidades) - Todas 48 horas

| Cidade | Prazo |
|---|---|
| São Paulo | 48 horas |
| Araçarigua | 48 horas |
| Arujá | 48 horas |
| Barueri | 48 horas |
| Biritiba Mirim | 48 horas |
| Caieiras | 48 horas |
| Cajamar | 48 horas |
| Carapicuíba | 48 horas |
| Cotia | 48 horas |
| Diadema | 48 horas |
| Embu | 48 horas |
| Embu-Guaçu | 48 horas |
| Ferraz de Vasconcelos | 48 horas |
| Francisco Morato | 48 horas |
| Franco da Rocha | 48 horas |
| Guararema | 48 horas |
| Guarulhos | 48 horas |
| Itapecerica da Serra | 48 horas |
| Itapevi | 48 horas |
| Itaquaquecetuba | 48 horas |
| Jandira | 48 horas |
| Jundiaí | 48 horas |
| Mairiporã | 48 horas |
| Mauá | 48 horas |
| Mogi das Cruzes | 48 horas |
| Osasco | 48 horas |
| Poá | 48 horas |
| Riacho Grande | 48 horas |
| Ribeirão Pires | 48 horas |
| Rio Grande da Serra | 48 horas |
| Santa Isabel | 48 horas |
| Santana do Parnaíba | 48 horas |
| Santo André | 48 horas |
| São Bernardo do Campo | 48 horas |
| São Caetano do Sul | 48 horas |
| Suzano | 48 horas |
| Taboão da Serra | 48 horas |
| Vargem Grande Paulista | 48 horas |
| Várzea Paulista | 48 horas |

### Minas Gerais (73 cidades) - 24h ou 48h

| Cidade | Prazo |
|---|---|
| Aguanil | 48 horas |
| Alfenas | 48 horas |
| Belo Horizonte | 24 horas |
| Betim | 24 horas |
| Boa Esperança | 24 horas |
| Bom Sucesso | 24 horas |
| Bonfim | 48 horas |
| Campanha | 48 horas |
| Campo Belo | 24 horas |
| Campo do Meio | 24 horas |
| Campos Gerais | 24 horas |
| Cana Verde | 24 horas |
| Candeias | 48 horas |
| Carmo da Cachoeira | 24 horas |
| Carmo da Mata | 24 horas |
| Carmópolis de Minas | 24 horas |
| Cláudio | 24 horas |
| Confins | 48 horas |
| Contagem | 24 horas |
| Coqueiral | 24 horas |
| Cristais | 24 horas |
| Crucilândia | 48 horas |
| Desterro de Entre Rios | 48 horas |
| Divinópolis | 48 horas |
| Elói Mendes | 24 horas |
| Ibirité | 48 horas |
| Ibituruna | 48 horas |
| Igarapé | 24 horas |
| Ijaci | 24 horas |
| Itaguara | 24 horas |
| Itapecerica | 48 horas |
| Itatiaiuçu | 24 horas |
| Itaúna | 48 horas |
| Itumirim | 24 horas |
| Itutinga | 48 horas |
| Juatuba | 48 horas |
| Lagoa Santa | 48 horas |
| Lavras | 24 horas |
| Luminárias | 48 horas |
| Machado | 48 horas |
| Mateus Leme | 48 horas |
| Matozinhos | 48 horas |
| Monsenhor Paulo | 48 horas |
| Nazareno | 48 horas |
| Nepomuceno | 24 horas |
| Nova Lima | 48 horas |
| Oliveira | 24 horas |
| Pará de Minas | 48 horas |
| Paraguaçu | 48 horas |
| Passa Tempo | 48 horas |
| Pedro Leopoldo | 48 horas |
| Perdões | 24 horas |
| Piracema | 48 horas |
| Pouso Alegre | 48 horas |
| Ribeirão das Neves | 48 horas |
| Ribeirão Vermelho | 24 horas |
| Rio Manso | 48 horas |
| Sabará | 48 horas |
| Santa Luzia | 48 horas |
| Santana da Vargem | 48 horas |
| Santana do Jacaré | 48 horas |
| Santo Antônio do Amparo | 24 horas |
| São Francisco de Paula | 24 horas |
| São Gonçalo do Sapucaí | 48 horas |
| São João Del Rey | 48 horas |
| São Joaquim de Bicas | 48 horas |
| São José da Lapa | 48 horas |
| São Tiago | 48 horas |
| Sarzedo | 48 horas |
| Três Corações | 24 horas |
| Três Pontas | 24 horas |
| Varginha | 24 horas |
| Vespasiano | 48 horas |

---

## Constantes da Tabela de Preços

| Parâmetro | Valor |
|---|---|
| Taxa de Seguro | 0,7% do valor da NF (0,007) |
| Pedágio | R$ 12,30 (fixo) |
| Taxa de Entrega (por volume extra) | R$ 95,00 |
| Volumes padrão | 2 |
| Fator peso (acima 250kg) | 0,747 × peso |

---

## Implementação Sugerida (Pseudocódigo)

```typescript
function calcularFreteFlordeMinas(cidade: string, estado: string, valorNF: number, pesoKg: number, volumes: number = 2) {
  // 1. Verificar se cidade é atendida
  const cidadeInfo = TABELA_CIDADES.find(c => c.cidade === cidade && c.estado === estado);
  if (!cidadeInfo) return { error: "Cidade não atendida" };

  // 2. Determinar valor base pela faixa de peso
  let valorBase: number;
  if (pesoKg >= 1 && pesoKg <= 50) {
    valorBase = 103.03;
  } else if (pesoKg > 50 && pesoKg <= 150) {
    valorBase = 160.27;
  } else if (pesoKg > 150 && pesoKg <= 250) {
    valorBase = 186.00;
  } else if (pesoKg > 250) {
    valorBase = pesoKg * 0.747;
  } else {
    return { error: "Peso inválido" };
  }

  // 3. Calcular seguro (0,7% do valor da NF)
  const seguro = valorNF * 0.007;

  // 4. Pedágio fixo
  const pedagio = 12.30;

  // 5. Taxa de entrega (por volume extra)
  const taxaEntrega = (volumes - 1) * 95.00;

  // 6. Total
  const freteTotal = valorBase + seguro + pedagio + taxaEntrega;
  const percentualFrete = freteTotal / valorNF;
  const prazo = cidadeInfo.prazo;

  return {
    freteTotal,
    percentualFrete,
    prazo,
    detalhamento: { valorBase, seguro, pedagio, taxaEntrega }
  };
}
```

# Referência Definitiva — 5 Transportadoras (Cotação de Frete)

> **DOCUMENTO CRÍTICO — NÃO MODIFICAR SEM AUTORIZAÇÃO**
>
> Este documento contém todas as informações necessárias para que as 5 transportadoras
> funcionem corretamente. Credenciais, endpoints, workarounds técnicos e cobertura geográfica.
> Última verificação: 26/07/2026 — Todas as 5 funcionando com sucesso.

---

## Resumo Geral

| # | Transportadora | Endpoint | Método | Cobertura | Prazo Típico |
|---|---|---|---|---|---|
| 1 | Alfa Transportes | `api.alfatransportes.com.br` | REST JSON | Nacional | 2–5 dias |
| 2 | Braspress | `api.braspress.com` | REST JSON | Nacional | 3–5 dias |
| 3 | Camilo dos Santos (SSW) | `ssw.inf.br` | SOAP XML | SC, RS, PR*, GO, BA | 1–3h |
| 4 | Rodonaves (RTE) | `quotation-apigateway.rte.com.br` | REST JSON | Nacional | 2–4 dias |
| 5 | Flor de Minas | Cálculo local (planilha) | N/A | Grande SP + MG parcial | 24–48h |

*PR exceto Curitiba (sem tabela negociada para Curitiba)

---

## 1. ALFA TRANSPORTES

### Credenciais

| Variável de Ambiente | Descrição | CNPJ Associado |
|---|---|---|
| `ALFA_API_KEY_1` | Chave API (campo `idr`) | 36.562.762/0001-29 (Palitos) |
| `ALFA_API_KEY_2` | Chave API (campo `idr`) | 50.128.808/0001-27 (Espetos) |

### Endpoint

```
POST https://api.alfatransportes.com.br/cotacao/v1.2/
Content-Type: application/json
```

### Parâmetros Obrigatórios

```json
{
  "idr": "<ALFA_API_KEY>",
  "cliTip": 1,
  "cliCep": "06460040",
  "merVlr": 5000,
  "merPeso": 50,
  "merM3": 0.5,
  "modoJson": 1,
  "quim": 0
}
```

| Campo | Descrição | Obrigatório |
|---|---|---|
| `idr` | API Key (identificador) | SIM |
| `cliTip` | Tipo pessoa (1=PJ, 2=PF) | SIM |
| `cliCep` | CEP destino (só números) | SIM |
| `merVlr` | Valor da mercadoria (R$) | SIM |
| `merPeso` | Peso em kg | SIM |
| `merM3` | Metro cúbico da mercadoria | **SIM** (erro 12 se ausente) |
| `modoJson` | Retornar JSON (sempre 1) | SIM |
| `cepRem` | CEP origem (só números) | Opcional |
| `merVol` | Quantidade de volumes | Opcional |
| `cliCnpj` | CNPJ destinatário | Opcional |

### Resposta de Sucesso

```json
{
  "cotVlr": 430.62,
  "cotPrazo": "5 DIAS UTEIS",
  "cotCodigo": 12345
}
```

### Erros Conhecidos

| Código | Mensagem | Solução |
|---|---|---|
| 12 | FALTA METRO CUBICO DA MERCADORIA | Enviar campo `merM3` (obrigatório) |
| 403 | Acesso bloqueado para o IP | Solicitar liberação à Alfa |

### Rastreamento

```
POST https://api.alfatransportes.com.br/rastreamento/v1.3/
```

### Arquivo: `server/alfaApi.ts`

---

## 2. BRASPRESS

### Credenciais (hardcoded no código)

| CNPJ | Usuário | Senha | Label |
|---|---|---|---|
| 36.562.762/0001-29 | `36562762000129_PRD` | `q6lxQgr5y8pv8sYx` | CNPJ 1 |
| 45.558.059/0001-38 | `45558059000138_PRD` | `ahNMi4R2fCDTHkzt` | CNPJ 2 |
| 50.128.808/0001-27 | `50128808000127_PRD` | `1w0PLb27N06p679Q` | CNPJ 3 |

### Endpoint

```
POST https://api.braspress.com/v1/cotacao/calcular/json
Authorization: Basic <base64(usuario:senha)>
Content-Type: application/json
```

### Parâmetros Obrigatórios

```json
{
  "cnpjRemetente": 36562762000129,
  "cnpjDestinatario": 45558059000138,
  "modal": "R",
  "tipoFrete": "1",
  "cepOrigem": 32210130,
  "cepDestino": 6460040,
  "vlrMercadoria": 5000,
  "peso": 50,
  "volumes": 5,
  "cubagem": [{ "altura": 0.5, "largura": 0.4, "comprimento": 0.6, "volumes": 5 }]
}
```

| Campo | Descrição | Obrigatório |
|---|---|---|
| `cnpjRemetente` | CNPJ do remetente (número inteiro) | SIM |
| `cnpjDestinatario` | CNPJ do destinatário (número inteiro) | SIM |
| `modal` | Tipo de transporte ("R" = Rodoviário) | SIM |
| `tipoFrete` | "1" = CIF, "2" = FOB | SIM |
| `cepOrigem` | CEP origem (número inteiro, sem zeros à esquerda) | SIM |
| `cepDestino` | CEP destino (número inteiro, sem zeros à esquerda) | SIM |
| `vlrMercadoria` | Valor da mercadoria | SIM |
| `peso` | Peso em kg | SIM |
| `volumes` | Quantidade de volumes | SIM |
| `cubagem` | Array com dimensões (altura, largura, comprimento em metros) | SIM |

### Resposta de Sucesso

```json
{
  "id": 123456,
  "prazo": 4,
  "totalFrete": 827.66
}
```

### Erros Conhecidos

| Erro | Causa | Solução |
|---|---|---|
| "CAMPOS DE ENTRADA NULOS" | CNPJ destinatário vazio ou inválido | Enviar CNPJ válido |
| "CEP DESTINO NÃO ENCONTRADO" | CEP com formato errado | Enviar como inteiro (sem zeros à esquerda) |

### Arquivo: `server/braspressApi.ts`

---

## 3. CAMILO DOS SANTOS (SSW)

### Credenciais

| Variável de Ambiente | Valor | Descrição |
|---|---|---|
| `SSW_DOMAIN` | `RCS` | Domínio SSW da Camilo |
| `SSW_USER` | `foxapi` | Login de acesso |
| `SSW_PASSWORD` | `14lt27ca` | Senha de acesso |
| `SSW_SENHA_PAGADOR` | `251038` | Senha do pagador |

### CNPJs Pagadores

- `36562762000129` (Palitos)
- `45558059000138` (Varetas)
- `50128808000127` (Espetos)

### Endpoint

```
POST https://ssw.inf.br/ws/sswCotacaoCliente/index.php
Content-Type: text/xml; charset=utf-8
SOAPAction: urn:sswinfbr.sswCotacaoCliente#cotar
```

### Envelope SOAP

```xml
<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"
                   xmlns:ns1="urn:sswinfbr.sswCotacaoCliente">
  <SOAP-ENV:Body>
    <ns1:cotar>
      <dominio>RCS</dominio>
      <login>foxapi</login>
      <senha>14lt27ca</senha>
      <cnpjPagador>36562762000129</cnpjPagador>
      <senhaPagador>251038</senhaPagador>
      <cepOrigem>32210130</cepOrigem>
      <cepDestino>86010010</cepDestino>
      <valorNF>5000.00</valorNF>
      <quantidade>5</quantidade>
      <peso>50.000</peso>
      <volume>0.5000</volume>
      <mercadoria>9</mercadoria>
      <cnpjDestinatario></cnpjDestinatario>
      <coletar>S</coletar>
      <entDificil>N</entDificil>
      <destContribuinte>S</destContribuinte>
      <cnpjRemetente></cnpjRemetente>
    </ns1:cotar>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>
```

### Cobertura Geográfica (Confirmada 26/07/2026)

| Estado | Cidades Testadas | Status |
|---|---|---|
| SC | Florianópolis, Blumenau, Joinville, Criciúma | ✅ Funciona |
| RS | Porto Alegre, Caxias do Sul | ✅ Funciona |
| PR | Londrina, Maringá | ✅ Funciona |
| PR | **Curitiba** | ❌ Sem tabela |
| GO | Goiânia | ✅ Funciona |
| BA | Salvador | ✅ Funciona |
| SP | Todas as cidades | ❌ Sem tabela |
| RJ | Rio de Janeiro | ❌ Sem tabela |
| MG | Belo Horizonte | ❌ Sem tabela |
| ES | Vitória | ❌ Sem tabela |

### Erros Conhecidos

| Erro | Significado | Solução |
|---|---|---|
| "Cliente não possui tabela de frete negociada" | Destino não coberto pela Camilo | Normal — usar outra transportadora |
| Resposta vazia | Domínio inválido | Usar domínio `RCS` |
| "CNPJ PAGADOR OU SENHA INVALIDOS" | senhaPagador errada | Verificar `SSW_SENHA_PAGADOR` |

### Arquivo: `server/sswApi.ts`

---

## 4. RODONAVES (RTE)

### Credenciais

| Variável de Ambiente | Valor | Descrição |
|---|---|---|
| `RODONAVES_USERNAME` | `VARETAS` | Usuário de acesso |
| `RODONAVES_PASSWORD` | (secret) | Senha de acesso |

### Endpoints

| Serviço | Hostname | IP Fixo | Porta |
|---|---|---|---|
| Token + Cotação | `quotation-apigateway.rte.com.br` | `200.210.75.41` | 443 |
| Token Prazo | `01wapi.rte.com.br` | `150.230.65.150` | 443 |
| DNE (CEP→Cidade) | `dne-api.rte.com.br` | `200.210.75.41` | 443 |

### WORKAROUND CRÍTICO — Bypass TLS/SNI

> **O Citrix NetScaler da Rodonaves bloqueia conexões TLS que enviam a extensão SNI (Server Name Indication).**
>
> A solução é:
> 1. Conectar diretamente ao IP (não ao hostname)
> 2. Enviar `servername: ""` nas opções do Node.js `https.request` (remove SNI do ClientHello)
> 3. Enviar o header `Host: <hostname>` manualmente
>
> Isso está implementado na função `httpsRequest()` em `rodonavesApi.ts`.

```typescript
// IMPLEMENTAÇÃO CRÍTICA - NÃO ALTERAR
const HOSTNAME_IP_MAP: Record<string, string> = {
  "01wapi.rte.com.br": "150.230.65.150",
  "quotation-apigateway.rte.com.br": "200.210.75.41",
  "dne-api.rte.com.br": "200.210.75.41",
};

// Na função httpsRequest:
const reqOptions = {
  hostname: knownIp || options.hostname,  // Conecta ao IP
  port: 443,
  path: options.path,
  method: options.method,
  headers: { ...headers, "Host": options.hostname },  // Host header com hostname real
  rejectUnauthorized: false,  // Necessário pois o cert é para o hostname, não o IP
  servername: "",  // CRÍTICO: Remove SNI do TLS ClientHello
};
```

### Fluxo de Autenticação

```
1. POST /token em quotation-apigateway.rte.com.br
   Body: auth_type=DEV&grant_type=password&username=VARETAS&password=<secret>
   → Retorna access_token (válido 5h)

2. POST /api/v1/gera-cotacao em quotation-apigateway.rte.com.br
   Authorization: Bearer <token>
   Body: JSON com dados da cotação
```

### Parâmetros da Cotação

```json
{
  "OriginCityId": 2588,
  "OriginZipCode": "32210130",
  "DestinationCityId": 8194,
  "DestinationZipCode": "06460040",
  "TotalWeight": 50,
  "EletronicInvoiceValue": 5000,
  "CustomerTaxIdRegistration": "36562762000129",
  "Ppieces": 5,
  "ReceiverCpfcnpj": "45558059000138"
}
```

### Resolução de Cidade (DNE API)

```
GET /api/v1/busca-cep?cep=32210130
Host: dne-api.rte.com.br
Authorization: Bearer <token_prazo>
→ Retorna { CityId: 2588, CityDescription: "CONTAGEM", StateInitials: "MG" }
```

Se a DNE API falhar, fallback para ViaCEP + busca-cidade:
```
GET /api/v1/busca-cidade?nome=CONTAGEM&estado=MG
```

### Resposta de Sucesso (Formato Novo)

```json
{
  "Value": 570.12,
  "DeliveryTime": 2,
  "ProtocolNumber": "219192132",
  "Type": "Normal"
}
```

### Resposta de Sucesso (Formato Legado)

```json
{
  "FreightValue": "570.12",
  "DeliveryTime": "2",
  "ProtocolId": 219192132
}
```

> O código suporta ambos os formatos (novo e legado) automaticamente.

### Erros Conhecidos

| Erro | Causa | Solução |
|---|---|---|
| ENOTFOUND / EAI_AGAIN | DNS intermitente para *.rte.com.br | IP fallback (HOSTNAME_IP_MAP) |
| TLS handshake timeout | Citrix bloqueando SNI | servername="" (sem SNI) |
| "Não localizado CEP" | CEP não coberto ou CityId errado | Verificar resolução DNE |
| "Expedidor não está inscrito no estado" | auth_type errado (PROD vs DEV) | Usar auth_type=DEV |

### Arquivo: `server/rodonavesApi.ts`

---

## 5. FLOR DE MINAS (Expresso Flor de Minas)

### Credenciais

Não requer credenciais — cálculo baseado em planilha local.

### Método de Cálculo

```
Total = Valor da Faixa de Peso + Taxa de Entrega + Pedágio + Seguro
```

| Componente | Valor |
|---|---|
| Faixa 0–50kg | R$ 103,03 |
| Faixa 51–150kg | R$ 160,27 |
| Faixa 151–250kg | R$ 186,00 |
| Acima de 250kg | R$ 0,747/kg |
| Taxa de Entrega | R$ 95,00 (fixo) |
| Pedágio | R$ 12,30 (fixo) |
| Seguro | 0,7% do valor NF |

### Exemplo (50kg, R$ 5.000):
```
R$ 103,03 + R$ 95,00 + R$ 12,30 + (R$ 5.000 × 0,007) = R$ 245,33
```

### Cobertura Geográfica

A Flor de Minas atende **exclusivamente** cidades da Grande São Paulo e região de MG (Lavras/Varginha):

**SP (48h):** São Paulo, Araçariguama, Arujá, Barueri, Biritiba Mirim, Caieiras, Cajamar, Carapicuíba, Cotia, Diadema, Embu, Embu-Guaçu, Ferraz de Vasconcelos, Francisco Morato, Franco da Rocha, Guarulhos, Itapecerica da Serra, Itapevi, Itaquaquecetuba, Jandira, Juquitiba, Mairiporã, Mauá, Mogi das Cruzes, Osasco, Pirapora do Bom Jesus, Poá, Ribeirão Pires, Rio Grande da Serra, Salesópolis, Santa Isabel, Santana de Parnaíba, Santo André, São Bernardo do Campo, São Caetano do Sul, São Lourenço da Serra, Suzano, Taboão da Serra, Vargem Grande Paulista

**MG (24h):** Belo Horizonte, Contagem, Betim, Lavras, Varginha, Três Corações, Alfenas

### Resolução de CEP

Usa ViaCEP (`https://viacep.com.br/ws/{cep}/json/`) para resolver CEP → cidade/estado, depois verifica se a cidade está na tabela de cobertura.

### Arquivo: `server/florDeminasApi.ts`

---

## Variáveis de Ambiente (Secrets)

| Variável | Transportadora | Descrição |
|---|---|---|
| `ALFA_API_KEY_1` | Alfa | API Key CNPJ 36.562.762/0001-29 |
| `ALFA_API_KEY_2` | Alfa | API Key CNPJ 50.128.808/0001-27 |
| `RODONAVES_USERNAME` | Rodonaves | Usuário (VARETAS) |
| `RODONAVES_PASSWORD` | Rodonaves | Senha |
| `SSW_DOMAIN` | Camilo/SSW | Domínio (RCS) |
| `SSW_USER` | Camilo/SSW | Login (foxapi) |
| `SSW_PASSWORD` | Camilo/SSW | Senha (14lt27ca) |
| `SSW_SENHA_PAGADOR` | Camilo/SSW | Senha pagador (251038) |

---

## CNPJs do Grupo Fox

| CNPJ | Empresa | Usado em |
|---|---|---|
| 36.562.762/0001-29 | Palitos Indústria e Comércio | Alfa, Braspress, SSW |
| 45.558.059/0001-38 | Varetas Indústria e Comércio | Braspress, SSW |
| 50.128.808/0001-27 | Espetos Indústria e Comércio | Alfa, Braspress, SSW |

---

## Teste de Validação (Última execução: 26/07/2026)

```
Origem: Contagem/MG (32210-130)
Destino: Barueri/SP (06460-040) + Londrina/PR (86010-010 para SSW)
Valor: R$5.000 | Peso: 50kg | Volumes: 5 | Cubagem: 0.5m³

✅ Alfa (36562762): R$430,62 — 5 dias úteis
✅ Alfa (50128808): R$489,34 — 5 dias úteis
✅ Braspress (36562762): R$827,66 — 4 dias
✅ Braspress (45558059): R$940,52 — 4 dias
✅ Braspress (50128808): R$940,52 — 4 dias
✅ Camilo/SSW (36562762): R$479,98 — 2h
✅ Camilo/SSW (45558059): R$479,98 — 2h
✅ Camilo/SSW (50128808): R$479,98 — 2h
✅ Rodonaves: R$570,12 — 2 dias úteis (Protocolo: 219192132)
✅ Flor de Minas: R$245,33 — 48 horas

RESULTADO: 5/5 TRANSPORTADORAS FUNCIONANDO
```

---

## Troubleshooting Rápido

| Sintoma | Transportadora | Causa Provável | Solução |
|---|---|---|---|
| "FALTA METRO CUBICO" | Alfa | Campo `merM3` ausente | Sempre enviar `metroCubico` |
| "Acesso bloqueado para o IP" | Alfa | IP do servidor não liberado | Contatar Alfa para liberar |
| "CAMPOS DE ENTRADA NULOS" | Braspress | CNPJ destinatário vazio | Enviar CNPJ válido |
| "CEP DESTINO NÃO ENCONTRADO" | Braspress | CEP como string com zeros | Converter para inteiro |
| "Cliente não possui tabela" | SSW/Camilo | Destino não coberto | Normal — usar outra |
| ENOTFOUND / timeout | Rodonaves | DNS intermitente | IP fallback automático |
| TLS handshake fail | Rodonaves | Citrix bloqueando SNI | servername="" (automático) |
| "Cidade não atendida" | Flor de Minas | Destino fora da cobertura | Normal — usar outra |

---

> **AVISO FINAL:** Se alguma transportadora parar de funcionar, verificar NESTA ORDEM:
> 1. Credenciais (env vars) estão corretas?
> 2. O endpoint está respondendo? (testar com curl)
> 3. O formato da requisição mudou? (verificar documentação da API)
> 4. Para Rodonaves: o IP mudou? (atualizar HOSTNAME_IP_MAP)
> 5. Para SSW/Camilo: a tabela de frete expirou? (contatar Camilo)

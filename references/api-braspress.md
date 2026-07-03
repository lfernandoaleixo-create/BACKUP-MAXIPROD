# API Braspress - Documentação

## Cotação de Frete
POST https://api.braspress.com/v1/cotacao/calcular/json

### Autenticação
- Basic Auth: Base64(usuario:senha)
- Header: `Authorization: Basic <base64>`

### Credenciais de Produção
- CNPJ 1: 36562762000129 | User: 36562762000129_PRD | Pass: q6lxQgr5y8pv8sYx
- CNPJ 2: 45558059000138 | User: 45558059000138_PRD | Pass: ahNMi4R2fCDTHkzt
- CNPJ 3: 50128808000127 | User: 50128808000127_PRD | Pass: 1w0PLb27N06p679Q

### Request Body (JSON)
| Atributo | Descrição | Obrigatório |
|----------|-----------|-------------|
| cnpjRemetente | CNPJ do remetente (precisa estar cadastrado na Braspress) | SIM |
| cnpjDestinatario | CNPJ/CPF do destinatário | SIM |
| cnpjConsignado | CNPJ do consignatário (para frete tipo 3) | NÃO |
| modal | 'R' rodoviário, 'A' aéreo | SIM |
| tipoFrete | 1=CIF, 2=FOB, 3=Consignado | SIM |
| cepOrigem | CEP de origem | SIM |
| cepDestino | CEP de destino | SIM |
| vlrMercadoria | Valor total da mercadoria | SIM |
| peso | Peso total (kg) | SIM |
| volumes | Quantidade total de volumes | SIM |
| cubagem | Lista de medidas [{comprimento, largura, altura, volumes}] em METROS | SIM |

### Response Body
| Atributo | Descrição |
|----------|-----------|
| id | ID único da cotação |
| prazo | Dias para entrega |
| totalFrete | Valor total do frete |

### Exemplo curl
```bash
curl -v -H "Authorization: Basic <base64>" -H "Content-Type: application/json" -d \
'{"cnpjRemetente":60701190000104,"cnpjDestinatario":30539356867,"modal":"R","tipoFrete":"1","cepOrigem":2323000,"cepDestino":7093090,"vlrMercadoria":100.00,"peso":50.55,"volumes":100, "cubagem":[{"altura":0.46,"largura":0.67,"comprimento":0.67,"volumes":10}]}' \
-X POST https://api.braspress.com/v1/cotacao/calcular/json
```

## Tracking
GET https://api.braspress.com/v1/tracking/... (a verificar)

## Notas
- Cotações válidas até 23h59m59s do dia realizado
- Se CNPJ/CPF destinatário não cadastrado, cotação baseada no CEP
- Cubagem: medidas em METROS

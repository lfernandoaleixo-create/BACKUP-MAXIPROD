# API Alfa Transportes - Documentação

## Cotação de Frete (REST/JSON)
URL Base: https://api.alfatransportes.com.br/cotacao/v1.2/
Método: POST

### Autenticação
- Campo `idr` no body = chave de acesso (API key)

### Credenciais Grupo Fox
- CNPJ 36562762000129 → chave: f1c2f8777aeb97b7bc5a2c5e8ba1cebd
- CNPJ 50128808000127 → chave: 8beb5fef5774058be0d51c280d4ddb59
- CNPJ 45558059000138 → sem chave (mesma tabela dos demais)

### Parâmetros (POST JSON)
| Campo | Descrição | Tipo | Obrigatório |
|-------|-----------|------|-------------|
| idr | Chave de acesso (API key) | String | Sim |
| cliTip | Tipo Cliente (1=PJ, 2=PF) | Inteiro | Sim |
| cliCnpj | CNPJ/CPF destinatário | Numérico | Não |
| cliCep | CEP destinatário | Numérico (8 dígitos) | Sim |
| merVlr | Valor da mercadoria | Numérico | Sim |
| merPeso | Peso bruto (kg) | Numérico | Sim |
| merM3 | Metro cúbico | Numérico | Sim |
| merVol | Volume (qtd volumes) | Inteiro | Não |
| quim | Produto químico (0=Não, 1=Sim) | Booleano | Não |
| dtEmbarque | Data de embarque | Data | Não |
| cepRem | CEP remetente | Numérico (8 dígitos) | Não |
| modoJson | Retorno (0=XML, 1=JSON) | Booleano | Não |
| cnpjRem | CNPJ remetente | Numérico | Não |
| zonaRural | Zona rural (0=Não, 1=Sim) | Booleano | Não |
| tipoPagador | Pagador (1=CIF, 2=FOB) | Inteiro | Não |

### Exemplo de Retorno JSON (status.numero = 1 = sucesso)
```json
{
  "id": "COT0008328211080924069506172",
  "status": {
    "numero": 1,
    "descricao": "COTACAO CONCLUIDA COM SUCESSO"
  },
  "cotacao": {
    "codigoCotacao": "9506172",
    "emissao": {
      "remetente": { "cnpjRemetente": "...", "nomeRemetente": "..." },
      "detinatario": { "cnpjDestinatario": "...", "nomeDestinatario": "...", "cidadeDestinatario": "..." },
      "transportadora": { "cnpjTransportadora": "...", "nomeTransportadora": "...", "cidadeTransportadora": "..." },
      "valoresCotacao": {
        "valorInicial": 265.28,
        "valorPedagio": 17.46,
        "valorSeguro": 4.08,
        "valorTaxa": 33.64,
        "valorImposto": 24.12,
        "valorTotal": 344.59
      },
      "diasEntrega": "3 DIAS UTEIS"
    }
  }
}
```

### Códigos de Retorno
| Código | Descrição |
|--------|-----------|
| 1 | COTACAO CONCLUIDA COM SUCESSO |
| 2 | ERRO NA API |
| 3 | FALTA IDENTIFICACAO |
| 4 | FALHA AO VERIFICAR IDENTIFICACAO |
| 5 | IDENTIFICACAO NAO ENCONTRADA |
| 6 | FALHA AO RECUPERAR OS VALORES DA COTACAO |
| 7 | FALTA TIPO DO DESTINATARIO |
| 8 | FALTA CNPJ-CPF DO DESTINATARIO |
| 9 | FALTA CEP DO DESTINATARIO |
| 10 | FALTA VALOR DA MERCADORIA |
| 11 | FALTA PESO DA MERCADORIA |
| 12 | FALTA METRO CUBICO DA MERCADORIA |
| 13 | FALHA AO CALCULAR |

## Rastreamento
URL: https://api.alfatransportes.com.br/rastreamento/v1.3/docs
(Documentação separada - para tracking de entregas)

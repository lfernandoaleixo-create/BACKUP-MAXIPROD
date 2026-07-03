# API SSW (Camilo dos Santos) - Documentação

## Cotação de Frete (SOAP/WSDL)
WSDL: https://ssw.inf.br/ws/sswCotacaoCliente/index.php?wsdl

### Método: cotar()

### Parâmetros
| Nome | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| dominio | string | Sim | Sigla de 3 caracteres para login no sistema SSW |
| login | string | Sim | Usuário da transportadora (opção 925) |
| senha | string | Sim | Senha do usuário |
| cnpjPagador | string | Sim | CNPJ do pagador do frete. ex: "73938678000131" |
| senhaPagador | string | Sim | Senha do pagador (opção 383). ex: "11122233" |
| cepOrigem | integer | Sim | CEP origem. ex: 01002900 |
| cepDestino | integer | Sim | CEP destino. ex: 80060195 |
| valorNF | decimal | Sim | Valor da carga |
| quantidade | integer | Sim | Quantidade de volumes |
| peso | decimal | Sim | Peso em Kg (até 3 casas decimais) |
| volume | decimal | Sim | Volume em m³ (até 4 casas decimais). Ex: 0.0054 |
| mercadoria | integer | Sim | Código tipo mercadoria (default = 1) |
| cnpjDestinatario | string | Não | CNPJ do destinatário |
| coletar | string | Não | S/N - Indicador de coleta |
| entDificil | string | Não | S/N - Indicador de entrega difícil |
| destContribuinte | string | Não | S/N - Se destinatário é contribuinte de ICMS |
| cnpjRemetente | string | Não | CNPJ do remetente |

### Retorno (XML)
| Nome | Tipo | Descrição |
|------|------|-----------|
| erro | integer | -2: erro login, -1: erro simulação, 0: sucesso, 1: alerta |
| mensagem | string | Mensagem de erro/alerta |
| pesoCalculo | decimal | Peso de cálculo |
| prazo | integer | Prazo de entrega em dias corridos |
| totalFrete | decimal | Valor total do frete (R$) |
| fretePeso | decimal | Frete peso (R$) |
| freteValor | decimal | Frete valor (R$) |
| despacho | decimal | Despacho (R$) |
| cat | decimal | CAT - Custo Adicional de Transporte (R$) |
| itr | decimal | ITR - Incremento ao Transporte Rodoviário (R$) |
| gris | decimal | GRIS - Gerenciamento de Risco (R$) |
| pedagio | decimal | Pedágio (R$) |
| tas | decimal | TAS - Taxa Adm Secretarias Fazenda (R$) |
| impostos | decimal | Impostos (R$) |

### Exemplo de Retorno Sucesso
```xml
<?xml version="1.0" encoding="UTF-8" ?>
<cotacao>
  <erro>0</erro>
  <mensagem/>
  <pesoCalculo>4.456</pesoCalculo>
  <prazo>2</prazo>
  <totalFrete>140.53</totalFrete>
  <fretePeso>100.00</fretePeso>
  <freteValor>1.00</freteValor>
  <despacho>7.82</despacho>
  <cat>13.48</cat>
  <itr>0.88</itr>
  <gris>7.51</gris>
  <pedagio>0.00</pedagio>
  <impostos>9.84</impostos>
</cotacao>
```

### Credenciais (A OBTER DO FERNANDO)
- dominio: ???
- login: ???
- senha: ???
- cnpjPagador: 36562762000129 / 45558059000138 / 50128808000127
- senhaPagador: ???

### Nota
- É um webservice SOAP (não REST)
- Precisa usar biblioteca SOAP para chamar
- Volume é em m³ (não dimensões individuais como Braspress)

# SSW API Research - Número de Cotação Camilo

## Findings

1. **sswCotacaoCliente** (https://ssw.inf.br/ws/sswCotacaoCliente/index.php) - endpoint que usamos
   - Retorna: erro, mensagem, pesoCalculo, prazo, totalFrete, fretePeso, freteValor, despacho, cat, itr, gris, pedagio, tas, adiclocal, suframa, devcannf, reembolso, outros, coleta, entrega, adicFrete, trt, impostos, tabCalculo, tar, pos, tdc, entGeral, agenda, paletiz, separa, capataz, veicDedic, CO2, RDC, seguroFluvial, redespFluvial
   - **NÃO retorna número de cotação**

2. **sswCotacao** (https://ssw.inf.br/ws/sswCotacao/index.php) - endpoint alternativo
   - Mesmos campos de retorno, também sem número de cotação
   - Tem operação getMercadoria adicional

3. **sswGravarCotacao** - NÃO EXISTE (404)

4. O número de cotação (ex: 2768465) vem do SITE da Camilo quando faz cotação manual.
   - Provavelmente é gerado por um endpoint interno do sistema SSW que grava a cotação no banco deles.

## Possível solução: sswCol (Coletas via API)
- A GPT page menciona: "SSWCol pode ser utilizado para gravar e relacionar. Coletas via API"
- URL: https://ssw.inf.br/ws/sswCol/index.php?wsdl
- Pode ter operação de gravar cotação

## Outra possibilidade: endpoint de pré-cotação
- O site da Camilo provavelmente usa um endpoint que GRAVA a cotação e retorna o ID
- Pode ser um endpoint REST ou outro SOAP que não é público

## Credenciais SSW
- Domain: RCS
- Login: foxapi
- Password: 14lt27ca (env SSW_PASSWORD)
- SenhaPagador: 251038 (env SSW_SENHA_PAGADOR)

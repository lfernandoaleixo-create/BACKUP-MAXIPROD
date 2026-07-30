# SSW Web System Automation - Key Findings

## Login Flow (WORKS)
1. GET https://sistema.ssw.inf.br/bin/ssw0422
2. POST https://sistema.ssw.inf.br/bin/ssw0422
   - Headers: Content-Type: application/x-www-form-urlencoded, X-Requested-With: XMLHttpRequest
   - Body: act=L&f1=RCS&f2=&f3=foxp&f4=2010
   - Response sets cookies: useri, remember, sigla_emp=RCS, login=foxp, chave=0870FWXWWF, ssw_dom=RCS, token=JWT
3. GET https://sistema.ssw.inf.br/bin/menu01 → shows menu with options

## Option 110 - Cotação de Fretes pelo Cliente
- Internal program: ssw1608
- URL: https://sistema.ssw.inf.br/bin/ssw1608
- Form action: /bin/ssw1608
- The form has a field 'nro_cotacao' which is the protocol number we need!

## Form Fields (ssw1608)
- f2: CNPJ pagador (onchange calls pag() function)
- f4: CEP origem (onchange calls hidepopup)
- f6: CEP destino (onchange calls ce2)
- f8: Valor NF (onchange calls cep)
- f9: Quantidade volumes (onchange calls hidepopup)
- f10: Coletar (S/N) - default S
- f12: Peso kg (onchange calls des)
- f13: Contribuinte (S/N) - default S
- f14: Entrega difícil (S/N) - default N
- f15-f18: Additional fields
- cubagem: Cubagem m³
- cgc_rem: CNPJ remetente (onchange calls rem)
- pesocalculo: Peso cálculo (output)
- nro_cotacao: Número da cotação (OUTPUT - this is what we need!)
- vlr_frete: Valor do frete (output)
- fretepeso, fretevalor, despacho, gris, etc: Breakdown fields (output)

## JavaScript Mechanism
- Uses ajaxEnvia(valor, newp, newparameters, newFormAction)
- ajaxEnvia builds URL: /bin/ssw1608?act=VALOR&f2=...&f4=...
- Sends POST to that URL with empty body
- Content-Type: application/x-www-form-urlencoded
- Response can be:
  - Full HTML page (starts with <!--html-->) → replaces entire page
  - Partial update (GoBack, field values)

## Problem
- The server returns the full form (37144 bytes) regardless of what parameters are sent
- The server appears to be stateful and processes fields one at a time based on user interaction
- Simple HTTP requests cannot replicate the stateful field-by-field interaction
- The server likely uses server-side session state to track which fields have been filled

## Solution: Use Puppeteer/Playwright
- Need to use a real browser to automate the form
- Fill fields one at a time, pressing Tab/Enter between them
- The server processes each field change via AJAX
- After all fields are filled, the server calculates and returns nro_cotacao

## Alternative: The SOAP API does NOT return numeroCotacao
- The sswCotacaoCliente SOAP API returns: erro, mensagem, pesoCalculo, prazo, totalFrete, etc.
- But NO numeroCotacao/protocolo field in the response
- The web system (ssw1608) is the ONLY way to get the protocol number

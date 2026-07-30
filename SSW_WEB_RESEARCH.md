# SSW Web System Research - Protocol Number

## Key Findings

1. **SSW SOAP API** (`sswCotacaoCliente` and `sswCotacao`) does NOT return a numeroCotacao/protocol number
2. The protocol number (e.g., 2768465) comes from the **SSW web system** (opção 422)
3. The web system is at: `https://sistema.ssw.inf.br/bin/ssw0422`

## SSW Web System Login
- URL: `https://sistema.ssw.inf.br/bin/ssw0422`
- Method: POST with `act=L&f1=RCS&f2=&f3=foxapi&f4=14lt27ca`
- Uses AJAX via `ajaxEnvia('L', 0)` function
- Sets cookies: `useri=; remember=0`
- The login seems to use AJAX, not a form submit

## SSW Web Cotacao Flow (from coleta2.js)
- The `savec()` function in `/scripts/coleta2.js` handles quotation saving
- It POSTs to `cotacao` endpoint with params:
  - find=SAVEN
  - f1=uf_origem, f2=cidade_origem, f3=uf_destino, f4=cidade_destino
  - f5=mercadoria, f6=peso_volume, f7=empresa, f8=contato
  - f9=email, f10=fone, f11=observacao, f12=human (captcha)
  - sm, sc, sigla_emp, ticket
- Response handler `handlerCot()` checks `data[0]`:
  - If "0": error message
  - If "1": success, redirects to `cotacao?new=<number>` (THIS IS THE PROTOCOL!)

## SSW Public Cotacao Page
- URL: `https://ssw.inf.br/2/cotacao`
- This is a public "Preciso de transportadora" page
- Uses Form1 action="cotacao" method="POST"
- Loads: rastreamento4.js, cotacao.js, coleta2.js

## Credentials
- Domain: RCS
- User: foxapi
- Password: 14lt27ca
- SenhaPagador: 251038

## Strategy
- Use the SSW web system to "gravar" the cotacao and get the number
- The web system login uses AJAX (not standard form submit)
- Need to figure out the AJAX login flow first, then navigate to cotacao module
- Alternative: try the public cotacao page at ssw.inf.br/2/cotacao which also saves quotations

## CNPJ Info for Camilo
- 36562762000129 (Fox CNPJ 1)
- 45558059000138 (Fox CNPJ 2)  
- 50128808000127 (Fox CNPJ 3)

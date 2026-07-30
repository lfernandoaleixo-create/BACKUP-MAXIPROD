# SSW Web Protocol Implementation Notes

## Overview
The Camilo dos Santos SOAP API (sswCotacaoCliente) does NOT return a protocol/cotação number.
To get the protocol, we use the SSW web system (ssw1608) via HTTP POST.

## Credentials
- Domain: RCS
- User: foxp
- Password: 2010
- Login URL: https://sistema.ssw.inf.br/bin/ssw0422
- Form URL: https://sistema.ssw.inf.br/bin/ssw1608

## Flow
1. GET /bin/ssw0422 → get initial cookies
2. POST /bin/ssw0422 with act=L&f1=RCS&f2=&f3=foxp&f4=2010 (X-Requested-With: XMLHttpRequest)
3. GET /bin/ssw1608 (establishes server-side session state)
4. POST /bin/ssw1608 with act=ENV and all form fields → returns XML with nro_cotacao

## Form Fields (ssw1608)
- f2: CNPJ pagador
- f4: Mercadoria (empty = default)
- f6: CEP origem (8 digits)
- f8: CEP destino (8 digits)
- f9: Tipo frete (1=CIF, 2=FOB)
- f10: Coletar (S/N)
- f12: CNPJ destinatário (optional, leave empty)
- f13: Contribuinte (S/N)
- f14: Entrega difícil (S/N)
- f15: Valor da NF
- f16: Quantidade volumes
- f17: Quantidade pares
- f18: Peso (Kg)
- f20: Cubagem (m³)
- f25: CNPJ remetente (cgc_rem)

## Response XML Structure
```xml
<simula>
  <erro>ERRO2</erro>  <!-- ERRO2 = warning but still valid -->
  <mensagem>...</mensagem>
  <pesoCalculo>15,000</pesoCalculo>
  <prazo>30/07/26</prazo>
  <totalFrete>86,23</totalFrete>
  <nro_cotacao>2779797</nro_cotacao>  <!-- THIS IS THE PROTOCOL! -->
  ...
</simula>
```

## Known Limitations
- CNPJ 50128808000127: "Usuário sem permissão para cotar frete com CNPJ da tabela (OPC 426)"
- CNPJs 36562762000129 and 45558059000138: work correctly
- Session cache: 10 minutes before re-login

## Test Results
- Pedido 1572 (CEP 21820092 RJ): Proto 2779799 (CNPJ 36562762), Proto 2779800 (CNPJ 45558059)
- Pedido 1594 (CEP 33205448 MG): Proto 2779801 (CNPJ 36562762), Proto 2779802 (CNPJ 45558059)

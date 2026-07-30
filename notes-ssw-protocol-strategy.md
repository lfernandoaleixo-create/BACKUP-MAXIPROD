# SSW Protocol Number Strategy

## Findings from Web System Investigation

1. Login with Domínio=RCS, Usuário=foxp, Senha=2010 WORKS (no CPF needed)
2. After login, we're at the main menu (menu01)
3. Option 110 "Cotação de Fretes pelo Cliente" is visible in the menu
4. However, when trying to navigate directly to ssw0110, it says "Opção 466 não liberada para o usuário"
5. The menu system uses AJAX to load options within the page frame

## Alternative Approach: SOAP API Already Returns numeroCotacao

Looking at the SOAP response parsing code in sswApi.ts:
```
numeroCotacao: parseXmlValue(xml, "numeroCotacao") || parseXmlValue(xml, "numero_cotacao") || parseXmlValue(xml, "cotacao") || "",
```

The SOAP API response DOES have a `numeroCotacao` field in the XML response. The issue is that it might be empty or the field name might be different.

## Strategy: Check if SOAP API is already returning numeroCotacao

Let me test the actual SOAP response to see if numeroCotacao is being returned but not captured properly.

If the SOAP API does NOT return a protocol number, then we need to:
1. Use the SSW web system programmatically (HTTP session with cookies)
2. Login via POST to ssw0422
3. Navigate to option 110 within the session
4. Submit the quotation form
5. Parse the response for the protocol number

## Web Login Flow (for programmatic access)
- POST to https://sistema.ssw.inf.br/bin/ssw0422
- Form fields: dominio=RCS, cpf=(empty), usuario=foxp, senha=2010
- After login, session cookie is set
- Then access option 110 within that session

## Environment Variables
- SSW_WEB_DOMAIN: RCS
- SSW_WEB_USER: foxp
- SSW_WEB_PASSWORD: 2010

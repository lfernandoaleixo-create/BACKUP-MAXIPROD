# Camilo/SSW Web Protocol Automation - Technical Notes

## Credentials (received from Fernando)
- **Domínio**: RCS
- **Usuário**: foxp
- **Senha**: 2010

## SSW Web System Details
- The SOAP API (`sswCotacaoCliente`) does NOT return a protocol/quotation number
- The protocol number only comes from the SSW **web system** (opção 422)
- URL: `https://ssw.inf.br/bin/ssw0422` (POST with form fields)
- The web system requires: CPF + web credentials (different from API credentials)
- Actually uses: Domínio + Usuário + Senha (not CPF)

## Current SSW API Configuration (in sswApi.ts)
- Domain: `process.env.SSW_DOMAIN || "RCS"` 
- Login: `process.env.SSW_USER || "foxapi"`
- Senha: `process.env.SSW_PASSWORD || "14lt27ca"`
- SenhaPagador: `process.env.SSW_SENHA_PAGADOR || "251038"`
- CEP Origem for Camilo: 37260-000 (Perdões/MG)

## Web System Credentials (NEW - for protocol number)
- These are DIFFERENT from the API credentials
- Domínio: RCS (same as API)
- Usuário: foxp (different from API user "foxapi")
- Senha: 2010 (different from API password)

## Implementation Plan
1. After SOAP quotation returns value/prazo, make a parallel request to SSW web system
2. Use HTTP POST to ssw.inf.br/bin/ssw0422 with form data (domínio, usuário, senha + shipment params)
3. Parse the response to extract the quotation number (e.g., "2768465")
4. Return the protocol number alongside the SOAP quotation results

## Environment Variables to Set
- SSW_WEB_DOMAIN: RCS
- SSW_WEB_USER: foxp  
- SSW_WEB_PASSWORD: 2010

## Key Files
- server/sswApi.ts: Current SOAP integration
- server/salesOrderRouter.ts: quoteByPedido procedure (line 2572), quoteAllCarriers
- server/freightPdfExport.ts: PDF generation
- client/src/pages/SimulacaoFrete.tsx: New freight simulation card (just created)
- client/src/pages/SettingsPage.tsx: Permission "gc.simulacaoFrete" added to GRANULAR_GC_FEATURES

# Status das Integrações de Frete (03/07/2026)

## 1. Braspress ✅ IMPLEMENTADA
- API REST: https://api.braspress.com/v1/cotacao/calcular/json
- Auth: Basic (usuario:senha)
- CNPJs:
  - 36562762000129 / 36562762000129_PRD / q6lxQgr5y8pv8sYx
  - 45558059000138 / 45558059000138_PRD / ahNMi4R2fCDTHkzt
  - 50128808000127 / 50128808000127_PRD / 1w0PLb27N06p679Q
- Params: cnpjRemetente, cnpjDestinatario, modal (R=rodoviário), tipoFrete (1=CIF), cepOrigem, cepDestino, vlrMercadoria, peso, volumes, cubagem (array com altura/largura/comprimento/volumes)
- Response: totalFrete, prazoEntrega

## 2. Alfa Transportes ✅ IMPLEMENTADA (módulo criado, falta integrar no router)
- API REST: POST https://api.alfatransportes.com.br/cotacao/v1.2/
- Auth: campo `idr` no body = API key
- CNPJs:
  - 36562762000129 → chave: env ALFA_API_KEY_1
  - 50128808000127 → chave: env ALFA_API_KEY_2
  - 45558059000138 → SEM CHAVE (mesma tabela)
- Params: idr, cliTip (1=PJ), cliCep, merVlr, merPeso, merM3, merVol, modoJson=1, cepRem
- Response JSON: status.numero=1 (sucesso), cotacao.emissao.valoresCotacao.valorTotal, cotacao.emissao.diasEntrega
- TESTE PASSOU: R$335.48 para SP, 3 dias úteis

## 3. Camilo dos Santos (SSW) ⚠️ PARCIAL (falta senhaPagador)
- API SOAP: POST https://ssw.inf.br/ws/sswCotacaoCliente/index.php
- Auth: dominio=RCS, login=foxp, senha=2010 (env vars SSW_DOMAIN, SSW_USER, SSW_PASSWORD)
- Falta: senhaPagador (campo obrigatório, cadastrada na opção 383 do sistema SSW)
- CNPJs pagadores: mesmos 3 (36562762000129, 45558059000138, 50128808000127)
- Params SOAP: dominio, login, senha, cnpjPagador, senhaPagador, cepOrigem, cepDestino, valorNF, quantidade, peso, volume(m³), mercadoria=1
- Response XML: erro(0=ok), totalFrete, prazo, fretePeso, freteValor, despacho, cat, itr, gris, pedagio, impostos
- TESTE: autenticou (erro=0) mas retornou valores zerados (provavelmente por falta de senhaPagador)

## Próximos passos:
- Integrar Alfa no salesOrderRouter (procedure quoteAlfa)
- Atualizar MarginBar para mostrar comparativo Braspress vs Alfa
- Quando Fernando enviar senhaPagador da SSW, ativar Camilo dos Santos

## CEP Origem padrão (Grupo Fox em Contagem/MG): 32010000

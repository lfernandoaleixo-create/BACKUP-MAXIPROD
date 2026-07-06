# Maxiprod Excel Template - Empresas (Clientes)

Format: .xls (old Excel format)
Sheet name: "Empresas"
Max 1000 rows per import.

## Columns (44 total)

| Col | Header | Required | Example |
|-----|--------|----------|---------|
| 1 | Apelido * | YES | MAXIPROD |
| 2 | Ativa | No | Sim/Não |
| 3 | CNPJ_OU_CPF | No | 91090522000187 or 888.888.888-88 |
| 4 | Razão social/Nome | No | Maxiprod Informática Industrial Ltda |
| 5 | Nome fantasia | No | Maxiprod Informática |
| 6 | Regime tributário * | YES | Normal / Simples Nacional |
| 7 | Tipo IE | No | Isento / Contribuinte / Não-contribuinte |
| 8 | IE | No | 2222 |
| 9 | IM | No | 2332 |
| 10 | RNTRC | No | |
| 11 | Website | No | www.maxiprod.com.br |
| 12 | Limite de crédito (R$) | No | 10.000,00 |
| 13 | E-mail para envio da NF-e | No | maxiprod@maxiprod.com.br |
| 14 | CEP | No | 90230-091 or 90230091 |
| 15 | Endereço | No | Rua Ernesto da Fontoura |
| 16 | Número | No | 1479 |
| 17 | Complemento | No | Sala 8 |
| 18 | Bairro | No | São Geraldo |
| 19 | Caixa postal | No | |
| 20 | Município | No | Porto Alegre |
| 21 | UF | No | RS |
| 22 | Região do cliente | No | Poa Zona Norte |
| 23 | Perfil do cliente | No | |
| 24 | Segmento do cliente | No | ERP |
| 25 | Forma de pedido do cliente | No | Nós ligamos / O cliente liga |
| 26 | Fone 1 | No | 51 30622936 or (51) 3062-2936 |
| 27 | Fone 2 | No | |
| 28 | Fone 3 | No | |
| 29 | Fone 4 | No | |
| 30 | É cliente potencial * | YES | Sim/Não |
| 31 | É cliente * | YES | Sim/Não |
| 32 | É representante * | YES | Sim/Não |
| 33 | É transportadora * | YES | Sim/Não |
| 34 | É fornecedor * | YES | Sim/Não |
| 35 | É parceiro * | YES | Sim/Não |
| 36 | É concorrente * | YES | Sim/Não |
| 37 | É instituição financeira * | YES | Sim/Não |
| 38 | E-mail | No | |
| 39 | Representante/Vendedor | No | André |
| 40 | Representante/Vendedor 2 | No | |
| 41 | Representante/Vendedor 3 | No | |
| 42 | Perfil de acesso para visualizar documentos de compra | No | ADMIN |
| 43 | Observações | No | Empresa muito especial |
| 44 | Resultado da importação | No | (filled by Maxiprod after import) |

## Mapping from vendor_clients to Maxiprod columns

| Maxiprod Column | vendor_clients field | Notes |
|----------------|---------------------|-------|
| Apelido * | razao_social (first word uppercase) | Required - short name |
| Ativa | "Sim" | Always active |
| CNPJ_OU_CPF | cnpj_cpf | Remove formatting |
| Razão social/Nome | razao_social | |
| Nome fantasia | nome_fantasia or razao_social | |
| Regime tributário * | "Normal" | Default |
| Tipo IE | Derive from ie field | Isento if empty |
| IE | ie | |
| CEP | cep | |
| Endereço | endereco | |
| Número | numero | |
| Complemento | complemento | |
| Bairro | bairro | |
| Município | municipio | |
| UF | uf | |
| Fone 1 | telefone1 | |
| Fone 2 | telefone2 | |
| É cliente potencial * | "Não" | |
| É cliente * | "Sim" | |
| É representante * | "Não" | |
| É transportadora * | "Não" | |
| É fornecedor * | "Não" | |
| É parceiro * | "Não" | |
| É concorrente * | "Não" | |
| É instituição financeira * | "Não" | |
| E-mail | email | |
| Representante/Vendedor | seller_name | |
| Observações | observacoes | |

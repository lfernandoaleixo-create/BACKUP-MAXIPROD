#!/usr/bin/env python3
"""Insert client fields and Maxiprod fields into the order finalization step."""

# Read the file
with open('client/src/pages/VendedorDetalhe.tsx', 'r') as f:
    content = f.read()

# The new sections to insert after the Observações textarea </div> and before the buttons
new_sections = '''
            {/* ===== DADOS DO CLIENTE (pré-preenchidos do cadastro) ===== */}
            <div className="pt-3 pb-1 border-t border-slate-100 dark:border-slate-700 mt-3">
              <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase mb-2">📋 Dados Fiscais do Cliente</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Regime Tributário</label>
                  <select value={regimeTributario} onChange={(e) => setRegimeTributario(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="Normal">Normal</option>
                    <option value="Simples Nacional">Simples Nacional</option>
                    <option value="MEI">MEI</option>
                    <option value="Lucro Presumido">Lucro Presumido</option>
                    <option value="Lucro Real">Lucro Real</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Inscrição Municipal</label>
                  <input type="text" value={inscricaoMunicipal} onChange={(e) => setInscricaoMunicipal(e.target.value)} placeholder="IM" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Inscrição SUFRAMA</label>
                  <input type="text" value={inscricaoSuframa} onChange={(e) => setInscricaoSuframa(e.target.value)} placeholder="SUFRAMA" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Situação Fiscal Especial</label>
                  <select value={situacaoFiscalEspecial} onChange={(e) => setSituacaoFiscalEspecial(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="Nenhuma">Nenhuma</option>
                    <option value="Zona Franca de Manaus">Zona Franca de Manaus</option>
                    <option value="Área de Livre Comércio">Área de Livre Comércio</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">CNAE Fiscal</label>
                  <input type="text" value={cnaeFiscal} onChange={(e) => setCnaeFiscal(e.target.value)} placeholder="0000000" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Email NF-e/NFC-e</label>
                  <input type="text" value={emailNfe} onChange={(e) => setEmailNfe(e.target.value)} placeholder="nfe@empresa.com" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Website</label>
                  <input type="text" value={websiteCliente} onChange={(e) => setWebsiteCliente(e.target.value)} placeholder="www.empresa.com.br" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
              </div>
            </div>

            {/* Dados de Venda */}
            <div className="pt-3 pb-1 border-t border-slate-100 dark:border-slate-700 mt-2">
              <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase mb-2">💼 Dados de Venda</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Limite de Crédito (R$)</label>
                  <input type="text" value={limiteCredito} onChange={(e) => setLimiteCredito(e.target.value)} placeholder="999.999,99" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Forma de Cobrança (padrão)</label>
                  <select value={formaCobranca} onChange={(e) => setFormaCobranca(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="">Selecione...</option>
                    <option value="Boleto">Boleto</option>
                    <option value="A prazo">A prazo</option>
                    <option value="À vista">À vista</option>
                    <option value="PIX">PIX</option>
                    <option value="Depósito">Depósito</option>
                    <option value="Cartão">Cartão</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Tabela de Preços</label>
                  <input type="text" value={tabelaPrecos} onChange={(e) => setTabelaPrecos(e.target.value)} placeholder="Nome da tabela" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Condição de Pagamento</label>
                  <input type="text" value={condicaoPagamento} onChange={(e) => setCondicaoPagamento(e.target.value)} placeholder="30/60/90 dias" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
              </div>
            </div>

            {/* Dados de Relacionamento (CRM) */}
            <div className="pt-3 pb-1 border-t border-slate-100 dark:border-slate-700 mt-2">
              <p className="text-[10px] font-bold text-teal-600 dark:text-teal-400 uppercase mb-2">🌐 Dados de Relacionamento (CRM)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Região</label>
                  <input type="text" value={regiao} onChange={(e) => setRegiao(e.target.value)} placeholder="Região" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Perfil</label>
                  <select value={perfil} onChange={(e) => setPerfil(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="">Selecione...</option>
                    <option value="Distribuidor">Distribuidor</option>
                    <option value="Varejista">Varejista</option>
                    <option value="Atacadista">Atacadista</option>
                    <option value="Indústria">Indústria</option>
                    <option value="Consumidor Final">Consumidor Final</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Forma de Pedido</label>
                  <select value={formaPedido} onChange={(e) => setFormaPedido(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="">Selecione...</option>
                    <option value="Telefone">Telefone</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Email">Email</option>
                    <option value="Presencial">Presencial</option>
                    <option value="App">App</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Produtos de Interesse</label>
                  <input type="text" value={produtosInteresse} onChange={(e) => setProdutosInteresse(e.target.value)} placeholder="Produtos de interesse" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Probabilidade de Negócio</label>
                  <select value={probabilidadeNegocio} onChange={(e) => setProbabilidadeNegocio(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="">Selecione...</option>
                    <option value="Alta">Alta</option>
                    <option value="Média">Média</option>
                    <option value="Baixa">Baixa</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Tamanho</label>
                  <select value={tamanho} onChange={(e) => setTamanho(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="">Selecione...</option>
                    <option value="Pequeno">Pequeno</option>
                    <option value="Médio">Médio</option>
                    <option value="Grande">Grande</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Atenção</label>
                  <select value={atencao} onChange={(e) => setAtencao(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="Normal">Normal</option>
                    <option value="Prioritário">Prioritário</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Fornecedor Atual</label>
                  <input type="text" value={fornecedorAtual} onChange={(e) => setFornecedorAtual(e.target.value)} placeholder="Concorrente atual" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400" />
                </div>
              </div>
            </div>

            {/* Cobrança */}
            <div className="pt-3 pb-1 border-t border-slate-100 dark:border-slate-700 mt-2">
              <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase mb-2">⚠️ Cobrança</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Situação</label>
                  <select value={situacaoCobranca} onChange={(e) => setSituacaoCobranca(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="SEM PROTESTO">SEM PROTESTO</option>
                    <option value="EM PROTESTO">EM PROTESTO</option>
                    <option value="PROTESTADO">PROTESTADO</option>
                    <option value="NEGATIVADO">NEGATIVADO</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ===== DADOS PARA MAXIPROD (movidos de Custos de Venda) ===== */}
            <div className="pt-3 pb-1 border-t border-slate-100 dark:border-slate-700 mt-2">
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase mb-2">🏭 Dados para Maxiprod (Pedido de Venda)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-[10px] text-slate-500 font-medium">Operação Fiscal <span className="text-red-500">*</span></label>
                  <select value={operacaoFiscal} onChange={(e) => setOperacaoFiscal(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="6101 - Fora do Estado - Madeira">6101 - Fora do Estado - Madeira</option>
                    <option value="6101 - Fora do Estado - Aromas">6101 - Fora do Estado - Aromas</option>
                    <option value="5101 - Dentro do Estado - Madeira">5101 - Dentro do Estado - Madeira</option>
                    <option value="5101 - Dentro do Estado - Aromas">5101 - Dentro do Estado - Aromas</option>
                    <option value="6108 - Fora do Estado - Consumidor Final">6108 - Fora do Estado - Consumidor Final</option>
                    <option value="5102 - Dentro do Estado - Revenda">5102 - Dentro do Estado - Revenda</option>
                    <option value="6102 - Fora do Estado - Revenda">6102 - Fora do Estado - Revenda</option>
                  </select>
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="text-[10px] text-slate-500 font-medium">Natureza da Operação</label>
                  <select value={naturezaOperacao} onChange={(e) => setNaturezaOperacao(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="Venda de produção do estabelecimento">Venda de produção do estabelecimento</option>
                    <option value="Venda de mercadoria adquirida">Venda de mercadoria adquirida</option>
                    <option value="Transferência de produção do estabelecimento">Transferência de produção do estabelecimento</option>
                    <option value="Devolução de compra">Devolução de compra</option>
                    <option value="Remessa para industrialização">Remessa para industrialização</option>
                    <option value="Remessa para conserto">Remessa para conserto</option>
                    <option value="Venda para entrega futura">Venda para entrega futura</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Estado Configurável</label>
                  <select value={estadoConfiguravel} onChange={(e) => setEstadoConfiguravel(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    <option value="MADEIRA">MADEIRA</option>
                    <option value="BAMBU">BAMBU</option>
                    <option value="AROMAS">AROMAS</option>
                    <option value="ESPETOS">ESPETOS</option>
                    <option value="MADEIRA IMPORTADA">MADEIRA IMPORTADA</option>
                    <option value="MATÉRIA-PRIMA IMPORTADA">MATÉRIA-PRIMA IMPORTADA</option>
                    <option value="EMBALAGENS">EMBALAGENS</option>
                    <option value="PALITOS">PALITOS</option>
                    <option value="DESCARTÁVEIS">DESCARTÁVEIS</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Data de Entrega</label>
                  <input type="date" value={dataEntregaPedido} onChange={(e) => setDataEntregaPedido(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-medium">Previsão de Entrega</label>
                  <input type="date" value={previsaoEntregaPedido} onChange={(e) => setPrevisaoEntregaPedido(e.target.value)} className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200" />
                </div>
              </div>
              <p className="text-[8px] text-amber-500 mt-1">Estes campos serão usados na exportação do pedido para o Maxiprod.</p>
            </div>
'''

# Find the insertion point: after the Observações </div> and before the buttons <div className="flex justify-between pt-2">
target = '''            </div>

            <div className="flex justify-between pt-2">
              <button onClick={() => isSimulation ? onClose() : setStep("cliente")} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">'''

replacement = '''            </div>
''' + new_sections + '''
            <div className="flex justify-between pt-2">
              <button onClick={() => isSimulation ? onClose() : setStep("cliente")} className="px-4 py-2 text-xs text-slate-600 hover:bg-slate-100 rounded-lg">'''

if target in content:
    content = content.replace(target, replacement, 1)
    with open('client/src/pages/VendedorDetalhe.tsx', 'w') as f:
        f.write(content)
    print("SUCCESS: Inserted client fields and Maxiprod fields into finalization step")
else:
    print("ERROR: Target text not found")
    # Try to find the approximate location
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'flex justify-between pt-2' in line and i > 6900:
            print(f"  Found 'flex justify-between pt-2' at line {i+1}")
            print(f"  Context: {lines[i-2:i+3]}")
            break

import puppeteer from 'puppeteer-core';

async function testSSWQuotation() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  try {
    const page = await browser.newPage();
    
    page.on('response', async (response) => {
      if (response.url().includes('ssw1608') && !response.url().includes('.js')) {
        const text = await response.text().catch(() => '');
        console.log(`  [NET] ${text.length}b: ${text.replace(/\n/g, ' ').substring(0, 200)}`);
      }
    });
    
    // Login
    await page.goto('https://sistema.ssw.inf.br/bin/ssw0422', { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
      document.querySelector('input[name="f1"]').value = 'RCS';
      document.querySelector('input[name="f3"]').value = 'foxp';
      document.querySelector('input[name="f4"]').value = '2010';
      document.frm.act.value = 'L';
      ajaxEnvia('L', 0);
    });
    await new Promise(r => setTimeout(r, 4000));
    console.log('Logged in');
    
    // Navigate to ssw1608
    await page.goto('https://sistema.ssw.inf.br/bin/ssw1608', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));
    console.log('Form loaded');
    
    // Helper
    async function fillAndEnter(id, value, waitMs = 3000) {
      const el = await page.$(`[id="${id}"]`);
      if (!el) { console.log(`Field ${id} not found!`); return; }
      await el.click();
      await el.evaluate(e => e.value = '');
      await el.type(value, { delay: 20 });
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, waitMs));
    }
    
    // Use correct data for Pedido 1586 (REPEL EMBALAGENS)
    // CEP origem: 37264000 (Aiuruoca - from pagador)
    // CEP destino: 13295000 (Itupeva/SP - REPEL)
    // Valor NF: 1213.00
    // Quantidade: 1
    // Peso: 10 kg
    // CNPJ destinatário: 04738569000100 (REPEL)
    
    // Step 1: CNPJ pagador
    await fillAndEnter('2', '36562762000129', 4000);
    console.log('Step 1: CNPJ pagador done');
    
    // Step 2: CEP origem (use pagador's CEP)
    await fillAndEnter('4', '37264000', 3000);
    console.log('Step 2: CEP origem done');
    
    // Step 3: CEP destino
    await fillAndEnter('6', '13295000', 3000);
    console.log('Step 3: CEP destino done');
    
    // Step 4: Valor NF
    await fillAndEnter('8', '1213', 3000);
    console.log('Step 4: Valor NF done');
    
    // Step 5: Quantidade
    await fillAndEnter('9', '1', 2000);
    console.log('Step 5: Quantidade done');
    
    // Step 6: Coletar - press Enter to accept default (S)
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 2000));
    console.log('Step 6: Coletar (S) done');
    
    // Step 7: Peso
    await fillAndEnter('12', '10', 3000);
    console.log('Step 7: Peso done');
    
    // Step 8: CNPJ destinatário (nomedest field or another field)
    // Let me check what field is focused now
    let currentFocus = await page.evaluate(() => {
      const active = document.activeElement;
      return active ? { id: active.id, name: active.name, tag: active.tagName } : null;
    });
    console.log('Current focus:', JSON.stringify(currentFocus));
    
    // Step 8: Contribuinte - press Enter for default (S)
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 2000));
    console.log('Step 8: Contribuinte done');
    
    // Step 9: Entrega difícil - press Enter for default (N)
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 2000));
    console.log('Step 9: Entrega difícil done');
    
    // Step 10: Valor NF (f15 - might be the same as f8)
    await fillAndEnter('15', '1213', 3000);
    console.log('Step 10: f15 done');
    
    // Step 11: f16 (quantidade pares?)
    await fillAndEnter('16', '1', 2000);
    console.log('Step 11: f16 done');
    
    // Step 12: f17 (peso?)
    await fillAndEnter('17', '10', 2000);
    console.log('Step 12: f17 done');
    
    // Step 13: f18 (cubagem?)
    await fillAndEnter('18', '0.05', 5000);
    console.log('Step 13: f18 done');
    
    // Check final results
    const finalState = await page.evaluate(() => ({
      objfocus: typeof objfocus !== 'undefined' ? objfocus : 'undefined',
      nro_cotacao: document.getElementById('nro_cotacao')?.value || '',
      vlr_frete: document.getElementById('vlr_frete')?.value || '',
      fretepeso: document.querySelector('[name="fretepeso"]')?.value || '',
      prazo: document.querySelector('[name="prazo"]')?.value || '',
      pesocalculo: document.getElementById('pesocalculo')?.value || '',
    }));
    console.log('\n=== FINAL RESULT ===');
    console.log(JSON.stringify(finalState, null, 2));
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

testSSWQuotation();

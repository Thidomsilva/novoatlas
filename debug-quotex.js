import { chromium } from 'playwright';

async function inspectQuotexLoginPage() {
  console.log('🔍 Inspecionando página de login da Quotex...');
  
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chromium'
  });
  
  const context = await browser.newContext({
    viewport: { width: 1366, height: 800 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo'
  });
  
  const page = await context.newPage();
  
  try {
    console.log('📄 Navegando para página de login...');
    await page.goto('https://qxbroker.com/pt/sign-in', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    await page.waitForTimeout(3000);
    
    console.log('🔍 Procurando seletores de input...');
    
    // Tentar diferentes seletores possíveis
    const selectors = [
      'input[name="email"]',
      'input[type="email"]', 
      'input[placeholder*="email"]',
      'input[placeholder*="Email"]',
      'input[id*="email"]',
      'input[class*="email"]',
      '[data-testid*="email"]',
      'input:nth-of-type(1)',
      'form input:first-child'
    ];
    
    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) {
        const attributes = await page.evaluate(el => {
          return {
            tagName: el.tagName,
            id: el.id,
            name: el.name,
            type: el.type,
            placeholder: el.placeholder,
            className: el.className,
            outerHTML: el.outerHTML.slice(0, 200) + '...'
          };
        }, element);
        
        console.log(`✅ Encontrado: ${selector}`);
        console.log('Atributos:', attributes);
        console.log('---');
      }
    }
    
    // Também procurar por campos de senha
    console.log('🔍 Procurando campos de senha...');
    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      'input[placeholder*="senha"]',
      'input[placeholder*="password"]',
      'input[id*="password"]'
    ];
    
    for (const selector of passwordSelectors) {
      const element = await page.$(selector);
      if (element) {
        console.log(`✅ Campo senha encontrado: ${selector}`);
      }
    }
    
    // Procurar botão de submit
    console.log('🔍 Procurando botão de submit...');
    const buttonSelectors = [
      'button[type="submit"]',
      'button:has-text("Entrar")',
      'button:has-text("Login")',
      'input[type="submit"]',
      '[role="button"]'
    ];
    
    for (const selector of buttonSelectors) {
      const element = await page.$(selector);
      if (element) {
        console.log(`✅ Botão encontrado: ${selector}`);
      }
    }
    
    // Tirar screenshot para análise
    await page.screenshot({ 
      path: 'quotex-login-debug.png',
      fullPage: true 
    });
    console.log('📸 Screenshot salvo como: quotex-login-debug.png');
    
    console.log('⏳ Deixando browser aberto por 30 segundos para inspeção manual...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('❌ Erro durante inspeção:', error);
  } finally {
    await browser.close();
  }
}

inspectQuotexLoginPage().catch(console.error);
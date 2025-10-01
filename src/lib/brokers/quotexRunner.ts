import path from 'node:path';
import fs from 'node:fs';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

type Side = 'CALL' | 'PUT';

export type PlaceOrderInput = {
  side: Side;
  stake: number;
  expiration_sec: 30 | 60 | 120;
  pair?: string; // futuro
};

const QX_LOGIN_URL = 'https://qxbroker.com/pt/sign-in';
const QX_TRADE_URL = 'https://qxbroker.com/pt/trade';

const STORAGE_DIR = process.env.PLAYWRIGHT_STORAGE_DIR || '.playwright';
const USER_DATA_DIR = process.env.PLAYWRIGHT_USER_DATA_DIR || path.resolve(STORAGE_DIR, 'chrome-profile');
const CHROME_CDP = process.env.CHROME_REMOTE_DEBUGGING_URL;
const LOCALE = process.env.LOCALE || 'pt-BR';
const TIMEZONE = process.env.TIMEZONE || 'America/Sao_Paulo';
const PROXY = process.env.PROXY_SERVER;
const HEADLESS = (process.env.PLAYWRIGHT_HEADLESS ?? '1') !== '0';
const CHANNEL = process.env.PLAYWRIGHT_CHANNEL || 'chromium';
const PERSISTENT = (process.env.PLAYWRIGHT_PERSISTENT ?? '1') !== '0';

class QuotexRunnerImpl {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private starting = false;

  async start(): Promise<void> {
    if (this.page && !this.page.isClosed()) return;
    if (this.starting) {
      // aguarde o start atual
      while (this.starting) await new Promise(r => setTimeout(r, 100));
      return;
    }
    this.starting = true;
    try {
      if (CHROME_CDP) {
        const browser = await chromium.connectOverCDP(CHROME_CDP);
        const context = browser.contexts()[0] || (await browser.newContext());
        const page = context.pages()[0] || (await context.newPage());
        await this.applyContextSettings(context);
        this.browser = browser;
        this.context = context;
        this.page = page;
        return;
      }
      if (PERSISTENT && !HEADLESS) {
        try {
          const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
            // Persistente só em modo headful.
            headless: false,
            channel: CHANNEL,
            locale: LOCALE,
            timezoneId: TIMEZONE,
            viewport: { width: 1366, height: 800 },
            colorScheme: 'light',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            proxy: PROXY ? { server: PROXY } : undefined,
            permissions: ['clipboard-read', 'clipboard-write'],
            geolocation: { latitude: -23.5505, longitude: -46.6333 },
            hasTouch: false,
            javaScriptEnabled: true,
            args: [
              '--disable-blink-features=AutomationControlled',
              '--disable-features=VizDisplayCompositor',
              '--disable-web-security',
              '--no-first-run',
              '--no-default-browser-check'
            ],
          });
          const page = context.pages()[0] || (await context.newPage());
          await this.applyContextSettings(context);
          this.browser = context.browser()!;
          this.context = context;
          this.page = page;
          return;
        } catch (err) {
          console.warn('[QuotexRunner] persistent context failed, falling back to non-persistent:', err);
        }
      }
      // Fallback: browser normal + newContext (sem perfil persistente)
      const browser = await chromium.launch({
        headless: HEADLESS,
        channel: CHANNEL,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
        proxy: PROXY ? { server: PROXY } : undefined,
      });
      const context = await browser.newContext({
        locale: LOCALE,
        timezoneId: TIMEZONE,
        viewport: { width: 1366, height: 800 },
        colorScheme: 'light',
        javaScriptEnabled: true,
      });
      const page = await context.newPage();
      await this.applyContextSettings(context);
      this.browser = browser;
      this.context = context;
      this.page = page;
    } finally {
      this.starting = false;
    }
  }

  private async applyContextSettings(context: BrowserContext) {
    await context.addInitScript(() => {
      // Melhorar stealth - parecer mais humano
      Object.defineProperty(navigator, 'language', { get: () => 'pt-BR' });
      Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
      
      // Remover indicadores de webdriver
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      
      // Simular chrome real
      Object.defineProperty(window, 'chrome', {
        get: () => ({
          runtime: {},
          loadTimes: function() {},
          csi: function() {},
          app: {}
        })
      });
      
      // Mascarar automation
      try { delete (window.navigator as any).__proto__.webdriver; } catch {}
    });
  }

  async loginIfNeeded(creds?: { email?: string; password?: string }): Promise<void> {
    await this.start();
    const page = this.page!;
    const email = creds?.email ?? process.env.QUOTEX_EMAIL;
    const password = creds?.password ?? process.env.QUOTEX_PASSWORD;
    if (!email || !password) throw new Error('Missing QUOTEX_EMAIL/QUOTEX_PASSWORD');

    console.log('🚀 [Quotex Login] Iniciando processo de login...');
    console.log('📝 [Quotex Login] Credenciais recebidas:', { 
      email: email.substring(0, 3) + '***', 
      password: '***fornecida***' 
    });

    // Tentar múltiplas URLs e estratégias
    const urls = [
      'https://qxbroker.com/pt/sign-in',
      'https://qxbroker.com/pt/trade',
      'https://quotex.io/pt/sign-in',
      'https://qx-broker.com/pt/sign-in'
    ];

    let success = false;
    let lastError: Error | null = null;

    for (const url of urls) {
      try {
        console.log(`🔄 [Quotex Login] Tentando URL: ${url}`);
        
        // Configurar timeout maior e estratégias de retry
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 60000 
        });

        // Verificar se a página carregou corretamente
        const title = await page.title();
        const currentUrl = page.url();
        console.log(`📄 [Quotex Login] Página carregada - Título: "${title}", URL: "${currentUrl}"`);

        // Detectar bloqueios
        if (title.includes('Access denied') || title.includes('Blocked') || 
            currentUrl.includes('blocked') || currentUrl.includes('error')) {
          console.log(`🚫 [Quotex Login] IP/Acesso bloqueado em ${url}`);
          continue;
        }

        // Aguardar carregamento completo
        await page.waitForTimeout(3000);

        // Verificar se já está logado
        if (await this.isLogged(page)) {
          console.log('✅ [Quotex Login] Já está logado');
          return;
        }

        // Lidar com Cloudflare se necessário
        await this.handleCloudflare(page);

        // Verificar se chegamos à página de login
        if (currentUrl.includes('/sign-in') || await page.$('input[type="email"], input[name="email"]')) {
          console.log('🔐 [Quotex Login] Página de login detectada, fazendo login...');
          
          const loginSuccess = await this.performLogin(page, email, password);
          if (loginSuccess) {
            success = true;
            break;
          }
        } else if (currentUrl.includes('/trade')) {
          // Se já estamos na página de trade, verificar se está logado
          if (await this.isLogged(page)) {
            console.log('✅ [Quotex Login] Login já realizado');
            success = true;
            break;
          } else {
            // Tentar ir para página de login
            console.log('🔄 [Quotex Login] Redirecionando para página de login...');
            await page.goto(url.replace('/trade', '/sign-in'), { 
              waitUntil: 'domcontentloaded',
              timeout: 30000 
            });
            await this.handleCloudflare(page);
            const loginSuccess = await this.performLogin(page, email, password);
            if (loginSuccess) {
              success = true;
              break;
            }
          }
        }

      } catch (error) {
        console.log(`❌ [Quotex Login] Erro ao tentar ${url}:`, error.message);
        lastError = error as Error;
        continue;
      }
    }

    if (!success) {
      const errorMsg = lastError ? lastError.message : 'Não foi possível acessar nenhuma URL da Quotex';
      console.log('💥 [Quotex Login] Falha completa:', errorMsg);
      throw new Error(`Falha na conexão com Quotex: ${errorMsg}. Possível bloqueio de IP ou problemas de conectividade.`);
    }

    console.log('✅ [Quotex Login] Login realizado com sucesso!');
  }

  private async performLogin(page: Page, email: string, password: string): Promise<boolean> {
    try {
      console.log('🔍 [Quotex Login] Procurando campos de login...');
      
      // Aguardar campos aparecerem
      await page.waitForTimeout(2000);

      const emailInput = await this.findEmailInput(page);
      const passwordInput = await this.findPasswordInput(page);
      
      if (!emailInput || !passwordInput) {
        console.log('❌ [Quotex Login] Campos de login não encontrados');
        await this.debugScreenshot(page, 'login-fields-not-found');
        return false;
      }
      
      console.log('✅ [Quotex Login] Campos encontrados, preenchendo...');
      await this.humanTypeInElement(page, emailInput, email);
      await page.waitForTimeout(500);
      await this.humanTypeInElement(page, passwordInput, password);
      await page.waitForTimeout(500);
      
      const submitButton = await this.findSubmitButton(page);
      if (submitButton) {
        console.log('🔘 [Quotex Login] Clicando no botão de login...');
        await this.humanClickElement(page, submitButton);
      } else {
        console.log('❌ [Quotex Login] Botão de submit não encontrado');
        return false;
      }
      
      // Aguardar resposta do login
      console.log('⏳ [Quotex Login] Aguardando resposta do login...');
      await page.waitForLoadState('networkidle', { timeout: 45000 });
      await page.waitForTimeout(3000);
      
      // Verificar se login foi bem-sucedido
      const loggedIn = await this.isLogged(page);
      if (loggedIn) {
        console.log('✅ [Quotex Login] Login confirmado!');
        return true;
      } else {
        console.log('❌ [Quotex Login] Login não confirmado');
        await this.debugScreenshot(page, 'login-failed');
        return false;
      }

    } catch (error) {
      console.log('❌ [Quotex Login] Erro durante login:', error.message);
      return false;
    }
  }

  async getBalance(): Promise<number | undefined> {
    await this.start();
    const page = this.page!;
    await page.goto(QX_TRADE_URL, { waitUntil: 'domcontentloaded' });
    if (!(await this.isLogged(page))) return undefined;
    return this.readBalance(page);
  }

  async placeOrder(input: PlaceOrderInput): Promise<{ ok: boolean; side: Side; stake: number; expiration_sec: number }> {
    await this.loginIfNeeded();
    const page = this.page!;
    await page.goto(QX_TRADE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // stake
    await this.setStake(page, input.stake);
    // expiration
    await this.setExpiration(page, input.expiration_sec);
    // side
    if (input.side === 'CALL') {
      await this.humanClick(page, 'button:has-text("CALL"), [data-testid*="call"], button[aria-label*="call" i]');
    } else {
      await this.humanClick(page, 'button:has-text("PUT"), [data-testid*="put"], button[aria-label*="put" i]');
    }
    await page.waitForTimeout(500);
    return { ok: true, side: input.side, stake: input.stake, expiration_sec: input.expiration_sec };
  }

  private async isLogged(page: Page): Promise<boolean> {
    const hasForm = await page.$('input[name="email"], form[action*="sign-in"]');
    if (hasForm) return false;
    const hasHeader = await page.$('header, [class*="balance"], [data-testid*="balance"]');
    return Boolean(hasHeader);
  }

  private parseCurrency(s: string): number {
    const cleaned = s.replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    return parseFloat(cleaned);
  }

  private async readBalance(page: Page): Promise<number | undefined> {
    const locatorCandidates = [
      '[data-testid*="balance"]',
      '[class*="balance"]',
      'text=/\$\s*\d[\d,.]*/i',
    ];
    for (const sel of locatorCandidates) {
      try {
        const el = await page.locator(sel).first();
        if (await el.count()) {
          const txt = (await el.textContent()) || '';
          const n = this.parseCurrency(txt);
          if (!Number.isNaN(n)) return n;
        }
      } catch { /* continue */ }
    }
    return undefined;
  }

  private async debugScreenshot(page: Page, tag: string) {
    try {
      const dir = path.resolve(process.cwd(), STORAGE_DIR, 'screenshots');
      await fs.promises.mkdir(dir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const file = path.join(dir, `${tag}-${ts}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.warn(`[QuotexRunner] Saved screenshot: ${file}`);
    } catch (e) {
      console.warn('[QuotexRunner] Failed to save screenshot', e);
    }
  }

  private rand(min: number, max: number) { return Math.random() * (max - min) + min; }

  private async humanType(page: Page, selector: string, text: string) {
    const el = await page.waitForSelector(selector, { state: 'visible', timeout: 15000 });
    await el.click({ delay: this.rand(20, 60) });
    for (const ch of text) {
      await page.keyboard.type(ch, { delay: this.rand(30, 120) });
      if (Math.random() < 0.02) await page.waitForTimeout(this.rand(50, 150));
    }
  }

  private async humanClick(page: Page, selector: string) {
    const el = await page.waitForSelector(selector, { state: 'visible', timeout: 15000 });
    const box = await el.boundingBox();
    if (!box) return el.click();
    const x = box.x + this.rand(0.3, 0.7) * box.width;
    const y = box.y + this.rand(0.3, 0.7) * box.height;
    const steps = Math.floor(this.rand(10, 20));
    await page.mouse.move(box.x + box.width / 2 + this.rand(-50, 50), box.y + box.height / 2 + this.rand(-30, 30), { steps: Math.floor(this.rand(5, 12)) });
    await page.waitForTimeout(this.rand(20, 80));
    await page.mouse.move(x, y, { steps });
    await page.waitForTimeout(this.rand(30, 120));
    await page.mouse.down();
    await page.waitForTimeout(this.rand(20, 60));
    await page.mouse.up();
  }

  private async setStake(page: Page, stake: number) {
    const selectors = [
      'input[name*="amount" i]',
      'input[aria-label*="amount" i]',
      'input[type="number"]',
    ];
    for (const sel of selectors) {
      const el = await page.$(sel);
      if (!el) continue;
      await el.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type(String(stake), { delay: this.rand(20, 80) });
      await page.waitForTimeout(100);
      return;
    }
    throw new Error('Stake input not found');
  }

  private async setExpiration(page: Page, sec: 30 | 60 | 120) {
    // Tentar botões rápidos com texto "30s", "60s", "120s"
    const btn = await page.$(`button:has-text("${sec}s")`);
    if (btn) {
      await this.humanClick(page, `button:has-text("${sec}s")`);
      await page.waitForTimeout(150);
      return;
    }
    // Tentar abrir seletor e escolher o alvo (heurística genérica)
    const openSel = await page.$('[data-testid*="expiration"], [class*="time" i]');
    if (openSel) {
      await openSel.click();
      await page.waitForTimeout(150);
      const opt = await page.$(`text=/^${sec}\s*s$/i`);
      if (opt) {
        await opt.click();
        await page.waitForTimeout(150);
        return;
      }
    }
    // fallback: ignorar se não achar (plataforma pode usar expiração por hora-alvo)
  }

  private async handleCloudflare(page: Page): Promise<boolean> {
    console.log('🛡️ [Quotex Login] Verificando Cloudflare...');
    
    // Aguardar a página carregar completamente
    await page.waitForTimeout(3000);
    
    try {
      // Verificar múltiplos indicadores de Cloudflare
      const cloudflareSelectors = [
        'input[type="checkbox"]',
        '[data-ray]',
        '#challenge-form',
        '.cf-challenge',
        '.challenge-container',
        'iframe[src*="challenges.cloudflare.com"]'
      ];

      let cloudflareDetected = false;
      let challengeElement = null;

      for (const selector of cloudflareSelectors) {
        challengeElement = await page.$(selector).catch(() => null);
        if (challengeElement) {
          cloudflareDetected = true;
          console.log(`🤖 [Quotex Login] Cloudflare detectado via: ${selector}`);
          break;
        }
      }

      if (!cloudflareDetected) {
        // Verificar pelo título ou texto da página
        const title = await page.title();
        const bodyText = await page.textContent('body').catch(() => '') || '';
        
        if (title.includes('Cloudflare') || title.includes('Just a moment') || 
            bodyText.includes('Checking your browser') || bodyText.includes('DDoS protection')) {
          cloudflareDetected = true;
          console.log('🤖 [Quotex Login] Cloudflare detectado via texto da página');
        }
      }

      if (cloudflareDetected) {
        console.log('☁️ [Quotex Login] Cloudflare challenge detectado, aguardando...');
        
        // Aguardar um tempo aleatório mais longo (simular comportamento humano)
        await page.waitForTimeout(this.rand(5000, 8000));

        // Se há um checkbox, tentar clicar
        if (challengeElement) {
          try {
            console.log('✅ [Quotex Login] Tentando resolver challenge...');
            await challengeElement.click();
            await page.waitForTimeout(this.rand(2000, 4000));
          } catch (error) {
            console.log('⚠️ [Quotex Login] Não conseguiu clicar no challenge');
          }
        }

        // Aguardar até que a página seja liberada (até 60 segundos)
        const maxWait = 60000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
          const currentTitle = await page.title();
          const currentUrl = page.url();
          
          // Verificar se saímos do Cloudflare
          if (!currentTitle.includes('Cloudflare') && 
              !currentTitle.includes('Just a moment') &&
              !currentUrl.includes('challenge')) {
            console.log('✅ [Quotex Login] Cloudflare resolvido!');
            await page.waitForTimeout(2000); // Aguardar estabilização
            return true;
          }
          
          await page.waitForTimeout(2000);
        }
        
        console.log('⚠️ [Quotex Login] Timeout aguardando resolução do Cloudflare');
        return false;
      }

      console.log('✅ [Quotex Login] Nenhum Cloudflare detectado');
      return false;

    } catch (error) {
      console.log('❌ [Quotex Login] Erro ao verificar Cloudflare:', (error as Error).message);
      return false;
    }
  }

  private async findEmailInput(page: Page): Promise<any> {
    const selectors = [
      'input[name="email"]',
      'input[type="email"]', 
      'input[placeholder*="email" i]',
      'input[placeholder*="e-mail" i]',
      'input[id*="email" i]',
      'input[class*="email" i]',
      'input[autocomplete="email"]',
      'form input:first-of-type',
      'input:nth-of-type(1)'
    ];
    
    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) {
        console.log(`📧 Campo de email encontrado: ${selector}`);
        return element;
      }
    }
    
    return null;
  }

  private async findPasswordInput(page: Page): Promise<any> {
    const selectors = [
      'input[name="password"]',
      'input[type="password"]',
      'input[placeholder*="senha" i]',
      'input[placeholder*="password" i]',
      'input[id*="password" i]',
      'input[class*="password" i]',
      'input[autocomplete="current-password"]'
    ];
    
    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) {
        console.log(`🔒 Campo de senha encontrado: ${selector}`);
        return element;
      }
    }
    
    return null;
  }

  private async findSubmitButton(page: Page): Promise<any> {
    const selectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Entrar")',
      'button:has-text("Login")',
      'button:has-text("Conectar")',
      '[role="button"]:has-text("Entrar")',
      'form button'
    ];
    
    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) {
        console.log(`🔘 Botão de submit encontrado: ${selector}`);
        return element;
      }
    }
    
    return null;
  }

  private async humanTypeInElement(page: Page, element: any, text: string): Promise<void> {
    await element.click({ delay: this.rand(20, 60) });
    await page.waitForTimeout(this.rand(100, 300));
    
    // Limpar campo primeiro
    await page.keyboard.press('Control+A');
    await page.waitForTimeout(50);
    
    for (const char of text) {
      await page.keyboard.type(char, { delay: this.rand(30, 120) });
      if (Math.random() < 0.02) await page.waitForTimeout(this.rand(50, 150));
    }
  }

  private async humanClickElement(page: Page, element: any): Promise<void> {
    const box = await element.boundingBox();
    if (!box) {
      await element.click();
      return;
    }
    
    const x = box.x + this.rand(0.3, 0.7) * box.width;
    const y = box.y + this.rand(0.3, 0.7) * box.height;
    const steps = Math.floor(this.rand(10, 20));
    
    await page.mouse.move(x + this.rand(-10, 10), y + this.rand(-10, 10), { steps });
    await page.waitForTimeout(this.rand(100, 300));
    await page.mouse.down();
    await page.waitForTimeout(this.rand(50, 150));
    await page.mouse.up();
  }
}

let singleton: QuotexRunnerImpl | null = null;
export function quotexRunner(): QuotexRunnerImpl {
  if (!singleton) singleton = new QuotexRunnerImpl();
  return singleton;
}

import path from 'node:path';
import fs from 'node:fs';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

type Side = 'CALL' | 'PUT';

export type PlaceOrderInput = {
  side: Side;
  stake: number;
  expiration_sec: 30 | 60 | 120;
  pair?: string;
};

const EXNOVA_LOGIN_URL = 'https://trade.exnova.com/pt/login';
const EXNOVA_TRADE_URL = 'https://trade.exnova.com/pt';

const STORAGE_DIR = process.env.PLAYWRIGHT_STORAGE_DIR || '.playwright';
const USER_DATA_DIR = process.env.PLAYWRIGHT_USER_DATA_DIR || path.resolve(STORAGE_DIR, 'exnova-profile');
const CHROME_CDP = process.env.CHROME_REMOTE_DEBUGGING_URL;
const LOCALE = process.env.LOCALE || 'pt-BR';
const TIMEZONE = process.env.TIMEZONE || 'America/Sao_Paulo';
const PROXY = process.env.PROXY_SERVER;
const HEADLESS = (process.env.PLAYWRIGHT_HEADLESS ?? '1') !== '0';
const CHANNEL = process.env.PLAYWRIGHT_CHANNEL || 'chromium';
const PERSISTENT = (process.env.PLAYWRIGHT_PERSISTENT ?? '1') !== '0';

class ExnovaRunnerImpl {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private starting = false;

  async start(): Promise<void> {
    if (this.page && !this.page.isClosed()) return;
    if (this.starting) {
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
          console.warn('[ExnovaRunner] persistent context failed, falling back to non-persistent:', err);
        }
      }
      // Fallback: browser normal + newContext
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
    const email = creds?.email ?? process.env.EXNOVA_EMAIL;
    const password = creds?.password ?? process.env.EXNOVA_PASSWORD;
    if (!email || !password) throw new Error('Missing EXNOVA_EMAIL/EXNOVA_PASSWORD');

    console.log('🚀 [Exnova Login] Iniciando processo de login...');
    console.log('📝 [Exnova Login] Credenciais recebidas:', { 
      email: email.substring(0, 3) + '***', 
      password: '***fornecida***' 
    });

    // Tentar múltiplas URLs da Exnova
    const urls = [
      'https://trade.exnova.com/pt/login',
      'https://trade.exnova.com/pt',
      'https://exnova.com/pt/login',
      'https://app.exnova.com/pt/login'
    ];

    let success = false;
    let lastError: Error | null = null;

    for (const url of urls) {
      try {
        console.log(`🔄 [Exnova Login] Tentando URL: ${url}`);
        
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 60000 
        });

        const title = await page.title();
        const currentUrl = page.url();
        console.log(`📄 [Exnova Login] Página carregada - Título: "${title}", URL: "${currentUrl}"`);

        // Detectar bloqueios
        if (title.includes('Access denied') || title.includes('Blocked') || 
            currentUrl.includes('blocked') || currentUrl.includes('error')) {
          console.log(`🚫 [Exnova Login] IP/Acesso bloqueado em ${url}`);
          continue;
        }

        await page.waitForTimeout(3000);

        // Verificar se já está logado
        if (await this.isLogged(page)) {
          console.log('✅ [Exnova Login] Já está logado');
          return;
        }

        // Lidar com proteções anti-bot
        await this.handleAntiBot(page);

        // Realizar login
        if (currentUrl.includes('/login') || await page.$('input[type="email"], input[name="email"]')) {
          console.log('🔐 [Exnova Login] Página de login detectada, fazendo login...');
          
          const loginSuccess = await this.performLogin(page, email, password);
          if (loginSuccess) {
            success = true;
            break;
          }
        } else if (currentUrl.includes('/trade') || currentUrl.includes('exnova.com/pt')) {
          // Verificar se já está na área logada
          if (await this.isLogged(page)) {
            console.log('✅ [Exnova Login] Login já realizado');
            success = true;
            break;
          } else {
            // Tentar ir para página de login
            console.log('🔄 [Exnova Login] Redirecionando para página de login...');
            await page.goto(EXNOVA_LOGIN_URL, { 
              waitUntil: 'domcontentloaded',
              timeout: 30000 
            });
            await this.handleAntiBot(page);
            const loginSuccess = await this.performLogin(page, email, password);
            if (loginSuccess) {
              success = true;
              break;
            }
          }
        }

      } catch (error) {
        console.log(`❌ [Exnova Login] Erro ao tentar ${url}:`, (error as Error).message);
        lastError = error as Error;
        continue;
      }
    }

    if (!success) {
      const errorMsg = lastError ? lastError.message : 'Não foi possível acessar nenhuma URL da Exnova';
      console.log('💥 [Exnova Login] Falha completa:', errorMsg);
      throw new Error(`Falha na conexão com Exnova: ${errorMsg}. Possível bloqueio de IP ou problemas de conectividade.`);
    }

    console.log('✅ [Exnova Login] Login realizado com sucesso!');
  }

  private async performLogin(page: Page, email: string, password: string): Promise<boolean> {
    try {
      console.log('🔍 [Exnova Login] Procurando campos de login...');
      
      await page.waitForTimeout(2000);

      const emailInput = await this.findEmailInput(page);
      const passwordInput = await this.findPasswordInput(page);
      
      if (!emailInput || !passwordInput) {
        console.log('❌ [Exnova Login] Campos de login não encontrados');
        await this.debugScreenshot(page, 'exnova-login-fields-not-found');
        return false;
      }
      
      console.log('✅ [Exnova Login] Campos encontrados, preenchendo...');
      await this.humanTypeInElement(page, emailInput, email);
      await page.waitForTimeout(500);
      await this.humanTypeInElement(page, passwordInput, password);
      await page.waitForTimeout(500);
      
      const submitButton = await this.findSubmitButton(page);
      if (submitButton) {
        console.log('🔘 [Exnova Login] Clicando no botão de login...');
        await this.humanClickElement(page, submitButton);
      } else {
        console.log('❌ [Exnova Login] Botão de submit não encontrado');
        return false;
      }
      
      console.log('⏳ [Exnova Login] Aguardando resposta do login...');
      await page.waitForLoadState('networkidle', { timeout: 45000 });
      await page.waitForTimeout(3000);
      
      const loggedIn = await this.isLogged(page);
      if (loggedIn) {
        console.log('✅ [Exnova Login] Login confirmado!');
        return true;
      } else {
        console.log('❌ [Exnova Login] Login não confirmado');
        await this.debugScreenshot(page, 'exnova-login-failed');
        return false;
      }

    } catch (error) {
      console.log('❌ [Exnova Login] Erro durante login:', (error as Error).message);
      return false;
    }
  }

  async getBalance(): Promise<number | undefined> {
    await this.start();
    const page = this.page!;
    await page.goto(EXNOVA_TRADE_URL, { waitUntil: 'domcontentloaded' });
    if (!(await this.isLogged(page))) return undefined;
    return this.readBalance(page);
  }

  async placeOrder(input: PlaceOrderInput): Promise<{ ok: boolean; side: Side; stake: number; expiration_sec: number }> {
    await this.loginIfNeeded();
    const page = this.page!;
    await page.goto(EXNOVA_TRADE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    await this.setStake(page, input.stake);
    await this.setExpiration(page, input.expiration_sec);
    
    const buttonSelector = input.side === 'CALL' ? 
      'button:has-text("HIGHER"), button:has-text("UP"), button:has-text("CALL"), [data-testid*="call"], [class*="call" i]' :
      'button:has-text("LOWER"), button:has-text("DOWN"), button:has-text("PUT"), [data-testid*="put"], [class*="put" i]';
    
    await this.humanClick(page, buttonSelector);
    await page.waitForTimeout(500);
    
    return { ok: true, side: input.side, stake: input.stake, expiration_sec: input.expiration_sec };
  }

  async close(): Promise<void> {
    if (this.page && !this.page.isClosed()) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    this.page = null;
    this.context = null;
    this.browser = null;
  }

  private async isLogged(page: Page): Promise<boolean> {
    const loggedSelectors = [
      '[data-testid*="balance"]',
      '[class*="balance"]',
      '[data-testid*="user"]',
      '[class*="user-menu"]',
      '[class*="trading-view"]',
      'button:has-text("CALL")',
      'button:has-text("PUT")',
      '.chart-container',
      '#trading-view'
    ];

    for (const selector of loggedSelectors) {
      const element = await page.$(selector);
      if (element) return true;
    }
    
    // Verificar URL
    const url = page.url();
    return !url.includes('/login') && !url.includes('/sign-in');
  }

  private async readBalance(page: Page): Promise<number> {
    const balanceSelectors = [
      '[data-testid*="balance"]',
      '[class*="balance"]',
      '[aria-label*="balance" i]',
      'text=/\$\s*\d[\d,.]*/i',
      '[class*="money"]'
    ];
    
    for (const sel of balanceSelectors) {
      try {
        const el = await page.locator(sel).first();
        if (await el.count()) {
          const txt = (await el.textContent()) || '';
          const n = this.parseCurrency(txt);
          if (!Number.isNaN(n)) return n;
        }
      } catch {/* continue */}
    }
    throw new Error('Balance element not found');
  }

  private parseCurrency(s: string): number {
    const cleaned = s.replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    const val = parseFloat(cleaned);
    return val;
  }

  private async debugScreenshot(page: Page, name: string) {
    try {
      await page.screenshot({ path: `/tmp/exnova-${name}-${Date.now()}.png`, fullPage: true });
    } catch {/* ignore */}
  }

  private rand(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  private async handleAntiBot(page: Page): Promise<boolean> {
    console.log('🛡️ [Exnova Login] Verificando proteções anti-bot...');
    
    await page.waitForTimeout(3000);
    
    try {
      const protectionSelectors = [
        'input[type="checkbox"]',
        '[data-ray]',
        '#challenge-form',
        '.cf-challenge',
        '.challenge-container',
        'iframe[src*="challenges"]'
      ];

      let protectionDetected = false;
      let challengeElement = null;

      for (const selector of protectionSelectors) {
        challengeElement = await page.$(selector).catch(() => null);
        if (challengeElement) {
          protectionDetected = true;
          console.log(`🤖 [Exnova Login] Proteção detectada via: ${selector}`);
          break;
        }
      }

      if (!protectionDetected) {
        const title = await page.title();
        const bodyText = await page.textContent('body').catch(() => '') || '';
        
        if (title.includes('Cloudflare') || title.includes('Just a moment') || 
            bodyText.includes('Checking your browser') || bodyText.includes('DDoS protection')) {
          protectionDetected = true;
          console.log('🤖 [Exnova Login] Proteção detectada via texto da página');
        }
      }

      if (protectionDetected) {
        console.log('☁️ [Exnova Login] Proteção anti-bot detectada, aguardando...');
        
        await page.waitForTimeout(this.rand(5000, 8000));

        if (challengeElement) {
          try {
            console.log('✅ [Exnova Login] Tentando resolver challenge...');
            await challengeElement.click();
            await page.waitForTimeout(this.rand(2000, 4000));
          } catch (error) {
            console.log('⚠️ [Exnova Login] Não conseguiu clicar no challenge');
          }
        }

        const maxWait = 60000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
          const currentTitle = await page.title();
          const currentUrl = page.url();
          
          if (!currentTitle.includes('Cloudflare') && 
              !currentTitle.includes('Just a moment') &&
              !currentUrl.includes('challenge')) {
            console.log('✅ [Exnova Login] Proteção resolvida!');
            await page.waitForTimeout(2000);
            return true;
          }
          
          await page.waitForTimeout(2000);
        }
        
        console.log('⚠️ [Exnova Login] Timeout aguardando resolução da proteção');
        return false;
      }

      console.log('✅ [Exnova Login] Nenhuma proteção detectada');
      return false;

    } catch (error) {
      console.log('❌ [Exnova Login] Erro ao verificar proteções:', (error as Error).message);
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
        console.log(`📧 [Exnova Login] Campo de email encontrado: ${selector}`);
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
        console.log(`🔒 [Exnova Login] Campo de senha encontrado: ${selector}`);
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
      'button:has-text("Sign in")',
      '[role="button"]:has-text("Entrar")',
      'form button'
    ];
    
    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) {
        console.log(`🔘 [Exnova Login] Botão de submit encontrado: ${selector}`);
        return element;
      }
    }
    
    return null;
  }

  private async humanTypeInElement(page: Page, element: any, text: string): Promise<void> {
    await element.click({ delay: this.rand(20, 60) });
    await page.waitForTimeout(this.rand(100, 300));
    
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
      '[data-testid*="amount"]'
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
    const btn = await page.$(`button:has-text("${sec}s")`);
    if (btn) {
      await this.humanClick(page, `button:has-text("${sec}s")`);
      await page.waitForTimeout(150);
      return;
    }
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
  }
}

let singleton: ExnovaRunnerImpl | null = null;
export function exnovaRunner(): ExnovaRunnerImpl {
  if (!singleton) singleton = new ExnovaRunnerImpl();
  return singleton;
}
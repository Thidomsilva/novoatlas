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

const IQ_LOGIN_URL = 'https://login.iqoption.com/pt/login';
const IQ_TRADE_URL = 'https://iqoption.com/pt/traderoom';
const IQ_APP_URL = 'https://iqoption.com/pt';

const STORAGE_DIR = process.env.PLAYWRIGHT_STORAGE_DIR || '.playwright';
const USER_DATA_DIR = process.env.PLAYWRIGHT_USER_DATA_DIR || path.resolve(STORAGE_DIR, 'iqoption-profile');
const CHROME_CDP = process.env.CHROME_REMOTE_DEBUGGING_URL;
const LOCALE = process.env.LOCALE || 'pt-BR';
const TIMEZONE = process.env.TIMEZONE || 'America/Sao_Paulo';
const PROXY = process.env.PROXY_SERVER;
const HEADLESS = (process.env.PLAYWRIGHT_HEADLESS ?? '1') !== '0';
const CHANNEL = process.env.PLAYWRIGHT_CHANNEL || 'chromium';
const PERSISTENT = (process.env.PLAYWRIGHT_PERSISTENT ?? '1') !== '0';

class IQOptionRunnerImpl {
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
          console.warn('[IQOptionRunner] persistent context failed, falling back to non-persistent:', err);
        }
      }
      // Fallback: browser normal + newContext
      const browser = await chromium.launch({
        headless: HEADLESS,
        channel: CHANNEL,
        args: [
          '--no-sandbox', 
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled'
        ],
        proxy: PROXY ? { server: PROXY } : undefined,
      });
      const context = await browser.newContext({
        locale: LOCALE,
        timezoneId: TIMEZONE,
        viewport: { width: 1366, height: 800 },
        colorScheme: 'light',
        javaScriptEnabled: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
    const email = creds?.email ?? process.env.IQOPTION_EMAIL;
    const password = creds?.password ?? process.env.IQOPTION_PASSWORD;
    if (!email || !password) throw new Error('Missing IQOPTION_EMAIL/IQOPTION_PASSWORD');

    console.log('🚀 [IQOption Login] Iniciando processo de login...');
    console.log('📝 [IQOption Login] Credenciais recebidas:', { 
      email: email.substring(0, 3) + '***', 
      password: '***fornecida***' 
    });

    // Tentar múltiplas URLs da IQ Option
    const urls = [
      'https://login.iqoption.com/pt/login',
      'https://iqoption.com/pt/login',
      'https://eu.iqoption.com/pt/login',
      'https://iqoption.com/pt'
    ];

    let success = false;
    let lastError: Error | null = null;

    for (const url of urls) {
      try {
        console.log(`🔄 [IQOption Login] Tentando URL: ${url}`);
        
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 60000 
        });

        const title = await page.title();
        const currentUrl = page.url();
        console.log(`📄 [IQOption Login] Página carregada - Título: "${title}", URL: "${currentUrl}"`);

        // Detectar bloqueios
        if (title.includes('Access denied') || title.includes('Blocked') || 
            currentUrl.includes('blocked') || currentUrl.includes('error')) {
          console.log(`🚫 [IQOption Login] IP/Acesso bloqueado em ${url}`);
          continue;
        }

        await page.waitForTimeout(3000);

        // Verificar se já está logado
        if (await this.isLogged(page)) {
          console.log('✅ [IQOption Login] Já está logado');
          return;
        }

        // Lidar com Cloudflare/proteções se necessário
        await this.handleProtection(page);

        // Realizar login se estivermos na página correta
        if (currentUrl.includes('login') || await page.$('input[type="email"], input[name="email"]')) {
          console.log('🔐 [IQOption Login] Página de login detectada, fazendo login...');
          
          const loginSuccess = await this.performLogin(page, email, password);
          if (loginSuccess) {
            success = true;
            break;
          }
        }

      } catch (error) {
        console.log(`❌ [IQOption Login] Erro ao tentar ${url}:`, (error as Error).message);
        lastError = error as Error;
        continue;
      }
    }

    if (!success) {
      const errorMsg = lastError ? lastError.message : 'Não foi possível acessar nenhuma URL da IQ Option';
      console.log('💥 [IQOption Login] Falha completa:', errorMsg);
      throw new Error(`Falha na conexão com IQ Option: ${errorMsg}. Possível bloqueio de IP ou problemas de conectividade.`);
    }

    console.log('✅ [IQOption Login] Login realizado com sucesso!');
  }

  private async performLogin(page: Page, email: string, password: string): Promise<boolean> {
    try {
      console.log('🔍 [IQOption Login] Procurando campos de login...');
      
      await page.waitForTimeout(2000);

      // Seletores específicos da IQ Option
      const emailSelectors = [
        'input[name="email"]',
        'input[type="email"]',
        'input[id="email"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="e-mail" i]',
        '#login_email',
        '[data-test-id="email"]'
      ];

      const passwordSelectors = [
        'input[name="password"]',
        'input[type="password"]',
        'input[id="password"]',
        '#login_password',
        '[data-test-id="password"]'
      ];

      let emailInput = null;
      let passwordInput = null;

      // Procurar campo de email
      for (const selector of emailSelectors) {
        emailInput = await page.$(selector);
        if (emailInput) {
          console.log(`📧 [IQOption Login] Campo de email encontrado: ${selector}`);
          break;
        }
      }

      // Procurar campo de senha
      for (const selector of passwordSelectors) {
        passwordInput = await page.$(selector);
        if (passwordInput) {
          console.log(`🔒 [IQOption Login] Campo de senha encontrado: ${selector}`);
          break;
        }
      }
      
      if (!emailInput || !passwordInput) {
        console.log('❌ [IQOption Login] Campos de login não encontrados');
        await this.debugScreenshot(page, 'iqoption-login-fields-not-found');
        return false;
      }
      
      console.log('✅ [IQOption Login] Campos encontrados, preenchendo...');
      await this.humanType(page, emailInput, email);
      await page.waitForTimeout(500);
      await this.humanType(page, passwordInput, password);
      await page.waitForTimeout(500);
      
      // Procurar botão de submit
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Entrar")',
        'button:has-text("Login")',
        'button:has-text("Sign In")',
        '[data-test-id="login-button"]',
        '.login-button',
        '#login-button'
      ];

      let submitButton = null;
      for (const selector of submitSelectors) {
        submitButton = await page.$(selector);
        if (submitButton) {
          console.log(`🔘 [IQOption Login] Botão de submit encontrado: ${selector}`);
          break;
        }
      }

      if (submitButton) {
        console.log('🔘 [IQOption Login] Clicando no botão de login...');
        await submitButton.click();
      } else {
        console.log('❌ [IQOption Login] Botão de submit não encontrado');
        return false;
      }
      
      console.log('⏳ [IQOption Login] Aguardando resposta do login...');
      await page.waitForLoadState('networkidle', { timeout: 45000 });
      await page.waitForTimeout(3000);
      
      const loggedIn = await this.isLogged(page);
      if (loggedIn) {
        console.log('✅ [IQOption Login] Login confirmado!');
        return true;
      } else {
        console.log('❌ [IQOption Login] Login não confirmado');
        await this.debugScreenshot(page, 'iqoption-login-failed');
        return false;
      }

    } catch (error) {
      console.log('❌ [IQOption Login] Erro durante login:', (error as Error).message);
      return false;
    }
  }

  private async isLogged(page: Page): Promise<boolean> {
    // IQ Option possui diferentes indicadores de login
    const loggedSelectors = [
      '[data-test-id="user-menu"]',
      '.user-menu',
      '.balance',
      '[class*="balance"]',
      '.trading-panel',
      '[data-test-id="balance"]',
      '.header-user'
    ];

    for (const selector of loggedSelectors) {
      const element = await page.$(selector);
      if (element) {
        console.log(`✅ [IQOption Login] Login confirmado via: ${selector}`);
        return true;
      }
    }

    // Verificar URL também
    const url = page.url();
    if (url.includes('traderoom') || url.includes('trading') || url.includes('platform')) {
      console.log('✅ [IQOption Login] Login confirmado via URL');
      return true;
    }

    return false;
  }

  private async handleProtection(page: Page): Promise<void> {
    console.log('🛡️ [IQOption Login] Verificando proteções...');
    
    await page.waitForTimeout(3000);
    
    try {
      const title = await page.title();
      const bodyText = await page.textContent('body').catch(() => '') || '';
      
      if (title.includes('Cloudflare') || title.includes('Just a moment') || 
          bodyText.includes('Checking your browser') || bodyText.includes('DDoS protection')) {
        console.log('☁️ [IQOption Login] Proteção detectada, aguardando...');
        
        // Aguardar resolução automática
        const maxWait = 60000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
          const currentTitle = await page.title();
          const currentUrl = page.url();
          
          if (!currentTitle.includes('Cloudflare') && 
              !currentTitle.includes('Just a moment') &&
              !currentUrl.includes('challenge')) {
            console.log('✅ [IQOption Login] Proteção resolvida!');
            await page.waitForTimeout(2000);
            return;
          }
          
          await page.waitForTimeout(2000);
        }
      }

    } catch (error) {
      console.log('❌ [IQOption Login] Erro ao verificar proteções:', (error as Error).message);
    }
  }

  private async humanType(page: Page, element: any, text: string): Promise<void> {
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

  private rand(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  private async debugScreenshot(page: Page, name: string): Promise<void> {
    try {
      await page.screenshot({ 
        path: `/tmp/${name}-${Date.now()}.png`,
        fullPage: true 
      });
    } catch (error) {
      console.log('❌ Erro ao tirar screenshot:', (error as Error).message);
    }
  }

  async getBalance(): Promise<number | undefined> {
    await this.start();
    const page = this.page!;
    
    if (!(await this.isLogged(page))) {
      return undefined;
    }

    // Seletores para o saldo da IQ Option
    const balanceSelectors = [
      '[data-test-id="balance"]',
      '.balance',
      '[class*="balance"]',
      '[data-testid*="balance"]'
    ];

    for (const selector of balanceSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await element.textContent() || '';
          const balance = this.parseBalance(text);
          if (!isNaN(balance)) {
            return balance;
          }
        }
      } catch {}
    }

    return undefined;
  }

  private parseBalance(text: string): number {
    const cleaned = text.replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    return parseFloat(cleaned);
  }

  async close(): Promise<void> {
    if (this.page && !this.page.isClosed()) {
      await this.page.close();
    }
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
    this.page = null;
    this.context = null;
    this.browser = null;
  }
}

let singleton: IQOptionRunnerImpl | null = null;
export function iqOptionRunner(): IQOptionRunnerImpl {
  if (!singleton) singleton = new IQOptionRunnerImpl();
  return singleton;
}
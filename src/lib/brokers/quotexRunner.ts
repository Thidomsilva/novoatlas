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
            userAgent: undefined,
            proxy: PROXY ? { server: PROXY } : undefined,
            permissions: ['clipboard-read', 'clipboard-write'],
            geolocation: { latitude: -23.5505, longitude: -46.6333 },
            hasTouch: false,
            javaScriptEnabled: true,
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
      Object.defineProperty(navigator, 'language', { get: () => 'pt-BR' });
      Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    });
  }

  async loginIfNeeded(creds?: { email?: string; password?: string }): Promise<void> {
    await this.start();
    const page = this.page!;
    const email = creds?.email ?? process.env.QUOTEX_EMAIL;
    const password = creds?.password ?? process.env.QUOTEX_PASSWORD;
    if (!email || !password) throw new Error('Missing QUOTEX_EMAIL/QUOTEX_PASSWORD');

    await page.goto(QX_TRADE_URL, { waitUntil: 'domcontentloaded' });
    if (await this.isLogged(page)) return;

    await page.goto(QX_LOGIN_URL, { waitUntil: 'domcontentloaded' });
    await this.humanType(page, 'input[name="email"]', email);
    await this.humanType(page, 'input[name="password"]', password);
    await this.humanClick(page, 'button[type="submit"], button:has-text("Entrar"), button:has-text("Login")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    if (!(await this.isLogged(page))) {
      try {
        await this.debugScreenshot(page, 'login-failed');
      } catch {}
      throw new Error('Login failed');
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
}

let singleton: QuotexRunnerImpl | null = null;
export function quotexRunner(): QuotexRunnerImpl {
  if (!singleton) singleton = new QuotexRunnerImpl();
  return singleton;
}

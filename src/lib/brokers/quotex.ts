import path from 'node:path';
import fs from 'node:fs';
import { chromium, type Browser, type Page, type BrowserContext, devices } from 'playwright';

const QX_LOGIN_URL = 'https://qxbroker.com/pt/sign-in';
const STORAGE_DIR = process.env.PLAYWRIGHT_STORAGE_DIR || '.playwright';
const USER_DATA_DIR = process.env.PLAYWRIGHT_USER_DATA_DIR || path.resolve(STORAGE_DIR, 'chrome-profile');
const STORAGE_FILE = path.resolve(process.cwd(), STORAGE_DIR, 'quotex-state.json');
const CHROME_CDP = process.env.CHROME_REMOTE_DEBUGGING_URL; // ex: http://127.0.0.1:9222

const LOCALE = process.env.LOCALE || 'pt-BR';
const TIMEZONE = process.env.TIMEZONE || 'America/Sao_Paulo';
const PROXY = process.env.PROXY_SERVER; // ex: http://user:pass@host:port

export type QuotexSessionInfo = {
  isLoggedIn: boolean;
  balance?: number;
  accountType?: 'real' | 'demo';
};

async function ensureStorageDir() {
  await fs.promises.mkdir(path.dirname(STORAGE_FILE), { recursive: true });
}

async function launchContext(): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  await ensureStorageDir();
  // Preferir anexar a um Chrome real do usuário (mais humano) se CDP estiver definido
  if (CHROME_CDP) {
    const browser = await chromium.connectOverCDP(CHROME_CDP);
    const context = browser.contexts()[0] || (await browser.newContext());
    const page = await (context.pages()[0] || context.newPage());
    await applyContextSettings(context);
    return { browser, context, page };
  }

  // Caso contrário, lançar um Chrome persistente com perfil próprio
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    locale: LOCALE,
    timezoneId: TIMEZONE,
    viewport: { width: 1366, height: 800 },
    colorScheme: 'light',
    userAgent: undefined, // deixar padrão do Chrome
    proxy: PROXY ? { server: PROXY } : undefined,
    permissions: ['clipboard-read', 'clipboard-write'],
    geolocation: { latitude: -23.5505, longitude: -46.6333 },
    hasTouch: false,
    javaScriptEnabled: true,
  });
  const page = await (context.pages()[0] || context.newPage());
  await applyContextSettings(context);
  return { browser: context.browser()!, context, page };
}

async function applyContextSettings(context: BrowserContext) {
  // Emular dispositivo desktop razoável
  await context.addInitScript(() => {
    // Ajustes leves anti-bot (sem prometer stealth absoluto)
    Object.defineProperty(navigator, 'language', { get: () => 'pt-BR' });
    Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR', 'pt', 'en-US', 'en'] });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  });
}

export async function quotexLogin(): Promise<QuotexSessionInfo> {
  const email = process.env.QUOTEX_EMAIL;
  const password = process.env.QUOTEX_PASSWORD;
  if (!email || !password) {
    throw new Error('Missing QUOTEX_EMAIL/QUOTEX_PASSWORD in env');
  }

  const { browser, context, page } = await launchContext();
  try {
    await page.goto(QX_LOGIN_URL, { waitUntil: 'domcontentloaded' });

    // Se já estiver logado, a página pode redirecionar para o app; detectamos saldo
    const alreadyLogged = await isLogged(page);
    if (alreadyLogged) {
      await saveState(page);
      const balance = await getBalance(page).catch(() => undefined);
      return { isLoggedIn: true, balance, accountType: undefined };
    }

    // Fluxo de login: localizar campos e enviar formulário
    await humanType(page, 'input[name="email"]', email);
    await humanType(page, 'input[name="password"]', password);
    await humanClick(page, 'button[type="submit"], button:has-text("Entrar"), button:has-text("Login")');

    // Aguardar navegação para a plataforma (heurística)
  await page.waitForLoadState('networkidle');
    // Em alguns casos, a plataforma fica em subdomínio; garantir que UI carregou algum elemento chave
    await page.waitForTimeout(2000);

    const ok = await isLogged(page);
    if (!ok) {
      throw new Error('Login failed or selectors changed');
    }
    await saveState(page);
    const balance = await getBalance(page).catch(() => undefined);
    return { isLoggedIn: true, balance, accountType: undefined };
  } finally {
    // Não fechar o contexto persistente (mantém sessão aberta). Fechamos apenas se for CDP e não queremos manter.
    if (CHROME_CDP) {
      await context.close();
      await page.context().browser()?.close();
    }
  }
}

export async function quotexStatus(): Promise<QuotexSessionInfo> {
  const { browser, context, page } = await launchContext();
  try {
    // Tente abrir diretamente a plataforma se houver sessão
    await page.goto('https://qxbroker.com/pt/trade', { waitUntil: 'domcontentloaded' });
    const ok = await isLogged(page);
    if (!ok) {
      return { isLoggedIn: false };
    }
    const balance = await getBalance(page).catch(() => undefined);
    return { isLoggedIn: true, balance };
  } finally {
    if (CHROME_CDP) {
      await context.close();
      await page.context().browser()?.close();
    }
  }
}

async function isLogged(page: Page): Promise<boolean> {
  // Heurísticas: presença de elementos da plataforma pós-login, ausência de formulário
  const hasForm = await page.$('input[name="email"], form[action*="sign-in"]');
  if (hasForm) return false;
  // Tente encontrar algum elemento que indique a área logada (ex.: saldo, menu da conta)
  const hasHeader = await page.$('header, [class*="balance"], [data-testid*="balance"]');
  return Boolean(hasHeader);
}

async function getBalance(page: Page): Promise<number> {
  // Como os seletores podem mudar, usamos algumas estratégias comuns:
  // 1) Elementos com data-testid
  // 2) Elementos com texto de moeda/símbolo
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
        const n = parseCurrency(txt);
        if (!Number.isNaN(n)) return n;
      }
    } catch {/* continue */}
  }
  throw new Error('Balance element not found');
}

function parseCurrency(s: string): number {
  // Remove símbolos e separadores comuns
  const cleaned = s.replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const val = parseFloat(cleaned);
  return val;
}

async function saveState(page: Page) {
  await ensureStorageDir();
  const state = await page.context().storageState();
  await fs.promises.writeFile(STORAGE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

// Utilidades de interação mais humanas
function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

async function humanType(page: Page, selector: string, text: string) {
  const el = await page.waitForSelector(selector, { state: 'visible', timeout: 15000 });
  await el.click({ delay: rand(20, 60) });
  for (const ch of text) {
    await page.keyboard.type(ch, { delay: rand(30, 120) });
    if (Math.random() < 0.02) await page.waitForTimeout(rand(50, 150)); // micro-pausa
  }
}

async function humanClick(page: Page, selector: string) {
  const el = await page.waitForSelector(selector, { state: 'visible', timeout: 15000 });
  const box = await el.boundingBox();
  if (!box) return el.click();
  const x = box.x + rand(0.3, 0.7) * box.width;
  const y = box.y + rand(0.3, 0.7) * box.height;
  // Trajetória em 10-20 passos
  const steps = Math.floor(rand(10, 20));
  const start = await page.mouse; // posição implícita
  const cur = { x: box.x + box.width / 2 + rand(-50, 50), y: box.y + box.height / 2 + rand(-30, 30) };
  await page.mouse.move(cur.x, cur.y, { steps: Math.floor(rand(5, 12)) });
  await page.waitForTimeout(rand(20, 80));
  await page.mouse.move(x, y, { steps });
  await page.waitForTimeout(rand(30, 120));
  await page.mouse.down();
  await page.waitForTimeout(rand(20, 60));
  await page.mouse.up();
}

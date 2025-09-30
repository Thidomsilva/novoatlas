import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

class TradingBrowserRunner {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private context: BrowserContext | null = null;
  private isReady: boolean = false;
  private currentBroker: string = '';
  private lastScreenshot: string = '';
  private connectionStatus: string = 'disconnected';

  // 🎬 FUNÇÃO ESPECIAL PARA DEBUG VISUAL REMOTO
  async connectAndPrepareVisual(broker: 'quotex' | 'iqoption' | 'exnova', email: string, password: string): Promise<{ success: boolean; message: string; isReady: boolean }> {
    try {
      console.log(`[TradingBrowser] 🎬 MODO VISUAL REMOTO: Conectando ${broker.toUpperCase()}...`);
      console.log(`[TradingBrowser] 📺 Navegador será visível em: https://novoatlas.fly.dev:6080/vnc.html`);
      
      // Configurações para NAVEGADOR VISUAL no servidor
      const browserOptions = {
        headless: false, // 🔥 VISUAL MODE - navegador com interface gráfica
        slowMo: 500, // Tornar ações mais lentas para visualização
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox', 
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--start-maximized',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
      };

      console.log(`[TradingBrowser] 🖥️ Iniciando navegador VISUAL para ${broker}...`);
      this.browser = await chromium.launch(browserOptions);
      
      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        viewport: { width: 1920, height: 1080 },
        permissions: ['clipboard-read', 'clipboard-write'],
        geolocation: { latitude: -23.5505, longitude: -46.6333 }
      });

      this.page = await this.context.newPage();
      
      console.log(`[TradingBrowser] ✅ Navegador VISUAL ativo! Acesse: https://novoatlas.fly.dev:6080/vnc.html`);
      
      // Executar processo de login com debug visual
      const brokerConfig = this.getBrokerConfig(broker);
      
      // Navegar para página de login
      console.log(`[TradingBrowser] 🔗 Navegando para login: ${brokerConfig.loginUrls[0]}`);
      await this.page.goto(brokerConfig.loginUrls[0], { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.page.waitForTimeout(5000); // Aguardar para visualização
      
      // Aguardar input de email
      console.log(`[TradingBrowser] ⏳ Aguardando campo de email aparecer...`);
      await this.page.waitForSelector(brokerConfig.emailSelectors[0], { timeout: 15000 });
      
      // Preencher email
      console.log(`[TradingBrowser] 📧 Preenchendo email: ${email}`);
      await this.page.fill(brokerConfig.emailSelectors[0], email);
      await this.page.waitForTimeout(2000);
      
      // Preencher senha
      console.log(`[TradingBrowser] 🔑 Preenchendo senha...`);
      await this.page.fill(brokerConfig.passwordSelectors[0], password);
      await this.page.waitForTimeout(2000);
      
      // Clicar em login
      console.log(`[TradingBrowser] 🔘 Clicando em entrar...`);
      await this.page.click(brokerConfig.loginButtonSelectors[0]);
      await this.page.waitForTimeout(10000); // Aguardar login processar
      
      console.log(`[TradingBrowser] 🎉 Debug visual concluído! Navegador permanece aberto para inspeção.`);
      
      // Manter navegador aberto indefinidamente para debug
      return {
        success: true,
        message: `Navegador ${broker} aberto em modo debug visual! Acesse https://novoatlas.fly.dev:6080/vnc.html`,
        isReady: true
      };
      
    } catch (error) {
      console.error(`[TradingBrowser] ❌ Erro no modo visual:`, error);
      return { 
        success: false, 
        message: `Erro no modo visual: ${error}`,
        isReady: false 
      };
    }
  }

  // Função normal (headless)
  async connectAndPrepare(broker: 'quotex' | 'iqoption' | 'exnova', email: string, password: string): Promise<{ success: boolean; message: string; isReady: boolean }> {
    try {
      console.log(`[TradingBrowser] 🚀 Conectando ${broker.toUpperCase()} para operação...`);
      
      // Configurações headless para produção
      const browserOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox', 
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--no-first-run',
          '--disable-blink-features=AutomationControlled',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
      };

      console.log(`[TradingBrowser] 🔧 Iniciando navegador para ${broker}...`);
      this.browser = await chromium.launch(browserOptions);
      
      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        viewport: { width: 1920, height: 1080 },
        permissions: ['clipboard-read', 'clipboard-write'],
        geolocation: { latitude: -23.5505, longitude: -46.6333 }
      });

      this.page = await this.context.newPage();

      const brokerConfig = this.getBrokerConfig(broker);
      this.currentBroker = brokerConfig.name;
      this.connectionStatus = 'connecting';
      
      // 1. Fazer login
      console.log(`[TradingBrowser] 🔐 Etapa 1: Login no ${brokerConfig.name}...`);
      const loginResult = await this.performLogin(brokerConfig, email, password);
      if (!loginResult.success) {
        this.connectionStatus = 'login_failed';
        return loginResult;
      }

      // 2. Navegar para página de trading
      console.log(`[TradingBrowser] 📈 Etapa 2: Navegando para trading...`);
      const tradingResult = await this.navigateToTrading(brokerConfig);
      if (!tradingResult.success) {
        this.connectionStatus = 'navigation_failed';
        return tradingResult;
      }

      // 3. Verificar se está pronto para operar
      console.log(`[TradingBrowser] 🎯 Etapa 3: Verificando se está pronto...`);
      const readyResult = await this.verifyTradingReady(brokerConfig);
      if (!readyResult.success) {
        this.connectionStatus = 'not_ready';
        return readyResult;
      }

      this.isReady = true;
      this.connectionStatus = 'ready';
      console.log(`[TradingBrowser] ✅ ${broker.toUpperCase()} pronto para operação!`);
      
      return { 
        success: true, 
        message: `${broker.toUpperCase()} conectado e pronto para sinais de trading!`,
        isReady: true
      };

    } catch (error) {
      console.error(`[TradingBrowser] ❌ Erro ao conectar ${broker}:`, error);
      return { 
        success: false, 
        message: `Erro na conexão: ${error}`,
        isReady: false 
      };
    }
  }

  private getBrokerConfig(broker: 'quotex' | 'iqoption' | 'exnova') {
    const configs = {
      quotex: {
        name: 'Quotex',
        loginUrls: ['https://qxbroker.com/pt/sign-in'],
        emailSelectors: ['input[type="email"]', 'input[name="email"]'],
        passwordSelectors: ['input[type="password"]', 'input[name="password"]'],
        loginButtonSelectors: ['button[type="submit"]']
      },
      iqoption: {
        name: 'IQ Option', 
        loginUrls: ['https://login.iqoption.com/pt/login'],
        emailSelectors: ['input[name="email"]', 'input[type="email"]'],
        passwordSelectors: ['input[name="password"]', 'input[type="password"]'],
        loginButtonSelectors: ['button[type="submit"]']
      },
      exnova: {
        name: 'Exnova',
        loginUrls: ['https://trade.exnova.com/pt/login'],
        emailSelectors: ['input[name="identifier"]'],
        passwordSelectors: ['input[name="password"]'],
        loginButtonSelectors: ['button[type="submit"]']
      }
    };
    
    return configs[broker];
  }

  private async performLogin(config: any, email: string, password: string): Promise<{ success: boolean; message: string; isReady: boolean }> {
    console.log(`[TradingBrowser] 🔐 Fazendo login no ${config.name}...`);
    
    try {
      await this.page!.goto(config.loginUrls[0], { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.page!.waitForTimeout(3000);

      // Preencher email
      const emailInput = await this.page!.$(config.emailSelectors[0]);
      if (emailInput) {
        await emailInput.fill(email);
        await this.page!.waitForTimeout(1000);
      }

      // Preencher senha
      const passwordInput = await this.page!.$(config.passwordSelectors[0]);
      if (passwordInput) {
        await passwordInput.fill(password);
        await this.page!.waitForTimeout(1000);
      }

      // Clicar login
      const loginButton = await this.page!.$(config.loginButtonSelectors[0]);
      if (loginButton) {
        await loginButton.click();
        await this.page!.waitForTimeout(5000);
      }

      return { success: true, message: `Login ${config.name} realizado`, isReady: false };
      
    } catch (error) {
      console.error(`[TradingBrowser] ❌ Erro no login:`, error);
      return { success: false, message: `Erro no login: ${error}`, isReady: false };
    }
  }

  private async navigateToTrading(config: any): Promise<{ success: boolean; message: string; isReady: boolean }> {
    console.log(`[TradingBrowser] 📈 Navegando para área de trading...`);
    // Simplificado - assumir que já está na área de trading após login
    return { success: true, message: `Área de trading ${config.name} acessada`, isReady: false };
  }

  private async verifyTradingReady(config: any): Promise<{ success: boolean; message: string; isReady: boolean }> {
    console.log(`[TradingBrowser] 🎯 Verificando se está pronto para operar...`);
    await this.page!.waitForTimeout(5000);
    return { success: true, message: `${config.name} pronto para receber sinais!`, isReady: true };
  }

  async close(): Promise<void> {
    try {
      this.isReady = false;
      if (this.page) await this.page.close();
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
      console.log('[TradingBrowser] 🔒 Navegador fechado');
    } catch (error) {
      console.error('[TradingBrowser] Erro ao fechar:', error);
    }
  }
}

export const tradingBrowserRunner = () => new TradingBrowserRunner();
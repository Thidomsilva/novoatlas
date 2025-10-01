import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

class LocalBrowserRunner {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private context: BrowserContext | null = null;

  async loginBrokerLocal(broker: 'quotex' | 'iqoption' | 'exnova', email: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`[LocalBrowser] Abrindo navegador VISUAL para ${broker.toUpperCase()}...`);
      
      // Configurações para navegador LOCAL VISUAL
      const browserOptions = {
        headless: false, // SEMPRE VISUAL localmente
        slowMo: 1000, // Movimentos lentos para observação
        devtools: true, // Abrir DevTools automaticamente
        args: [
          '--start-maximized', // Janela maximizada
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--no-first-run',
          '--disable-blink-features=AutomationControlled'
        ]
      };

      console.log('[LocalBrowser] Iniciando Chromium...');
      this.browser = await chromium.launch(browserOptions);
      
      console.log('[LocalBrowser] Criando contexto...');
      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        viewport: null, // Usa o tamanho da janela
        permissions: ['clipboard-read', 'clipboard-write'],
        geolocation: { latitude: -23.5505, longitude: -46.6333 } // São Paulo
      });

      console.log('[LocalBrowser] Criando página...');
      this.page = await this.context.newPage();

      // Logs do console da página
      this.page.on('console', (msg) => {
        console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
      });

      // Mascarar automation
      await this.page.addInitScript(() => {
        // Remove webdriver flag
        delete (navigator as any).__proto__.webdriver;
        
        // Override outras detecções
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        
        // Remove automation flags
        (window as any).chrome = {
          runtime: {},
        };
      });

      // URLs específicas para cada broker
      let urls: string[] = [];
      let brokerName = '';
      
      if (broker === 'quotex') {
        urls = [
          'https://qxbroker.com/pt/sign-in',
          'https://qxbroker.com/pt/trade',
          'https://quotex.io/pt/sign-in'
        ];
        brokerName = 'Quotex';
      } else if (broker === 'iqoption') {
        urls = [
          'https://login.iqoption.com/pt/login',
          'https://iqoption.com/pt/login',
          'https://iqoption.com/pt'
        ];
        brokerName = 'IQ Option';
      } else if (broker === 'exnova') {
        urls = [
          'https://trade.exnova.com/pt/login',
          'https://exnova.com/pt/login',
          'https://exnova.com/pt'
        ];
        brokerName = 'Exnova';
      }

      for (const url of urls) {
        try {
          console.log(`[LocalBrowser] 🔄 Tentando acessar ${brokerName}: ${url}`);
          
          await this.page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
          });

          // Aguardar carregamento
          await this.page.waitForTimeout(3000);

          const pageTitle = await this.page.title();
          const pageUrl = this.page.url();
          console.log(`[LocalBrowser] 📄 Carregado - Título: "${pageTitle}", URL: "${pageUrl}"`);

          // Verificar proteções
          const bodyText = await this.page.textContent('body') || '';
          const bodyHtml = await this.page.content();
          
          if (bodyText.includes('cloudflare') || bodyHtml.includes('cloudflare') || 
              bodyText.includes('captcha') || bodyText.includes('robot')) {
            console.log(`[LocalBrowser] ⚠️ Proteção detectada em ${brokerName}. Aguarde resolver ou interaja manualmente...`);
            // Não retornar erro, deixar o usuário resolver manualmente
            await this.page.waitForTimeout(10000);
          }

          // Procurar campos de login
          const emailSelectors = this.getEmailSelectors(broker);
          const passwordSelectors = this.getPasswordSelectors(broker);
          const loginButtons = this.getLoginButtonSelectors(broker);

          let emailInput = null;
          let passwordInput = null;

          // Encontrar campo de email
          for (const selector of emailSelectors) {
            try {
              emailInput = await this.page.$(selector);
              if (emailInput) {
                console.log(`[LocalBrowser] ✅ Campo email encontrado: ${selector}`);
                break;
              }
            } catch (e) {
              // Continuar tentando
            }
          }

          // Encontrar campo de senha
          for (const selector of passwordSelectors) {
            try {
              passwordInput = await this.page.$(selector);
              if (passwordInput) {
                console.log(`[LocalBrowser] ✅ Campo senha encontrado: ${selector}`);
                break;
              }
            } catch (e) {
              // Continuar tentando
            }
          }

          if (emailInput && passwordInput) {
            console.log(`[LocalBrowser] 📝 Preenchendo credenciais do ${brokerName}...`);
            
            // Preencher com delay visual
            await emailInput.fill(email);
            await this.page.waitForTimeout(2000);
            
            await passwordInput.fill(password);
            await this.page.waitForTimeout(2000);

            // Procurar botão de login
            let loginButton = null;
            for (const selector of loginButtons) {
              try {
                loginButton = await this.page.$(selector);
                if (loginButton) {
                  console.log(`[LocalBrowser] 🔘 Botão login encontrado: ${selector}`);
                  break;
                }
              } catch (e) {
                // Continuar tentando
              }
            }

            if (loginButton) {
              console.log(`[LocalBrowser] 🔘 Clicando no botão de login do ${brokerName}...`);
              await loginButton.click();
              
              // Aguardar redirecionamento
              console.log(`[LocalBrowser] ⏳ Aguardando resposta do login...`);
              await this.page.waitForTimeout(5000);
              
              const currentUrl = this.page.url();
              console.log(`[LocalBrowser] 📍 URL atual: ${currentUrl}`);

              // Verificar sucesso (deixar navegador aberto independente do resultado)
              console.log(`[LocalBrowser] ✅ Navegador mantido aberto para ${brokerName}. Você pode continuar operando manualmente!`);
              console.log(`[LocalBrowser] 💡 O navegador ficará aberto para você usar a ferramenta sobreposta.`);
              
              return { 
                success: true, 
                message: `Navegador ${brokerName} aberto e pronto para uso! Mantenha esta janela aberta para operar.` 
              };
            }
          }

          console.log(`[LocalBrowser] ⚠️ Campos não encontrados em ${url}. Você pode fazer login manualmente.`);
          // Continuar para próxima URL ou deixar aberto para login manual
          
        } catch (error) {
          console.error(`[LocalBrowser] ❌ Erro com URL ${url}:`, error);
          continue;
        }
      }

      // Mesmo sem login automático, deixar navegador aberto
      console.log(`[LocalBrowser] 🌐 Navegador ${brokerName} aberto. Faça login manualmente se necessário.`);
      return { 
        success: true, 
        message: `Navegador ${brokerName} aberto. Complete o login manualmente se necessário.` 
      };

    } catch (error) {
      console.error('[LocalBrowser] ❌ Erro geral:', error);
      return { success: false, message: `Erro ao abrir navegador: ${error}` };
    }
  }

  private getEmailSelectors(broker: string): string[] {
    if (broker === 'quotex') {
      return [
        'input[type="email"]',
        'input[name="email"]',
        'input[placeholder*="email" i]',
        '.email input'
      ];
    } else if (broker === 'iqoption') {
      return [
        'input[name="email"]',
        'input[type="email"]',
        'input[placeholder*="e-mail" i]',
        'input[data-test="email"]'
      ];
    } else if (broker === 'exnova') {
      return [
        'input[placeholder*="e-mail" i]',
        'input[name="email"]',
        'input[type="email"]'
      ];
    }
    return [];
  }

  private getPasswordSelectors(broker: string): string[] {
    if (broker === 'quotex') {
      return [
        'input[type="password"]',
        'input[name="password"]',
        '.password input'
      ];
    } else if (broker === 'iqoption') {
      return [
        'input[name="password"]',
        'input[type="password"]',
        'input[data-test="password"]'
      ];
    } else if (broker === 'exnova') {
      return [
        'input[name="password"]',
        'input[type="password"]'
      ];
    }
    return [];
  }

  private getLoginButtonSelectors(broker: string): string[] {
    return [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Login")',
      'button:has-text("Entrar")',
      'button[data-test="submit"]'
    ];
  }

  // NÃO fechar automaticamente - deixar navegador aberto para operação
  async keepAlive(): Promise<void> {
    console.log('[LocalBrowser] 🔄 Navegador mantido vivo para operação contínua...');
    // Não fazer nada - manter navegador aberto indefinidamente
  }

  async close(): Promise<void> {
    try {
      console.log('[LocalBrowser] 🔒 Fechando navegador (apenas se solicitado)...');
      if (this.page) await this.page.close();
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
    } catch (error) {
      console.error('[LocalBrowser] Erro ao fechar:', error);
    }
  }
}

export const localBrowserRunner = () => new LocalBrowserRunner();
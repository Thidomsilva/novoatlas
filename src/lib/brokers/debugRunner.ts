import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

class DebugRunner {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private context: BrowserContext | null = null;

  async loginBroker(broker: 'quotex' | 'iqoption' | 'exnova', email: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`[DebugRunner] Iniciando processo de login DEBUG para ${broker.toUpperCase()}...`);
      
      // Configurações do navegador DEBUG (com screenshots e logs detalhados)
      const browserOptions = {
        headless: true, // Headless no servidor, mas com debug máximo
        slowMo: 500, // Reduz velocidade para melhor análise
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-dev-tools',
          '--no-zygote',
          '--single-process',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=VizDisplayCompositor',
          '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
      };

      console.log('[DebugRunner] Abrindo navegador...');
      this.browser = await chromium.launch(browserOptions);
      
      console.log('[DebugRunner] Criando contexto...');
      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        viewport: null // Usa tamanho da janela
      });

      console.log('[DebugRunner] Criando página...');
      this.page = await this.context.newPage();

      // Configurar logs detalhados de console
      this.page.on('console', (msg) => {
        console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
      });

      // Configurar logs de requests
      this.page.on('request', (request) => {
        console.log(`[Request] ${request.method()} ${request.url()}`);
      });

      // Configurar logs de responses
      this.page.on('response', (response) => {
        console.log(`[Response] ${response.status()} ${response.url()}`);
      });

      // Mascarar automation
      await this.page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });

      // URLs específicas para cada broker
      let urls: string[] = [];
      let brokerName = '';
      
      if (broker === 'quotex') {
        urls = [
          'https://qxbroker.com/pt/sign-in',
          'https://quotex.io/pt/sign-in',
          'https://quotex.com/pt/sign-in'
        ];
        brokerName = 'Quotex';
      } else if (broker === 'iqoption') {
        urls = [
          'https://login.iqoption.com/pt/login',
          'https://iqoption.com/pt/login',
          'https://eu.iqoption.com/pt/login'
        ];
        brokerName = 'IQ Option';
      } else if (broker === 'exnova') {
        urls = [
          'https://trade.exnova.com/pt/login',
          'https://exnova.com/pt/login',
          'https://app.exnova.com/pt/login'
        ];
        brokerName = 'Exnova';
      }

      for (const url of urls) {
        try {
          console.log(`[DebugRunner] Tentando acessar: ${url}`);
          
          await this.page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
          });

          console.log('[DebugRunner] Aguardando elementos de login...');
          
          // Aguardar a página carregar
          await this.page.waitForTimeout(3000);

          // Screenshot da página inicial
          const screenshot1 = await this.page.screenshot({ fullPage: true });
          const screenshot1Base64 = screenshot1.toString('base64');
          console.log(`[DebugRunner] Screenshot inicial salvo (${screenshot1Base64.length} chars)`);
          
          // Log do HTML da página para análise
          const pageTitle = await this.page.title();
          const pageUrl = this.page.url();
          console.log(`[DebugRunner] Título: "${pageTitle}", URL: "${pageUrl}"`);

          // Verificar se existe algum bloqueio, captcha ou proteção
          const bodyText = await this.page.textContent('body') || '';
          const bodyHtml = await this.page.content();
          
          // Detecções específicas
          const hasCloudflare = bodyText.includes('cloudflare') || bodyHtml.includes('cloudflare') || 
                               bodyHtml.includes('challenges.cloudflare.com') || 
                               pageTitle.toLowerCase().includes('checking your browser');
          
          const hasRecaptcha = bodyText.includes('recaptcha') || bodyHtml.includes('recaptcha');
          const hasHcaptcha = bodyText.includes('hcaptcha') || bodyHtml.includes('hcaptcha');
          const hasCaptcha = bodyText.includes('captcha') || hasRecaptcha || hasHcaptcha;
          const hasBlocking = bodyText.includes('robot') || bodyText.includes('blocked') || 
                             bodyText.includes('access denied') || bodyText.includes('forbidden');

          if (hasCloudflare || hasCaptcha || hasBlocking) {
            let blockType = [];
            if (hasCloudflare) blockType.push('CLOUDFLARE');
            if (hasRecaptcha) blockType.push('RECAPTCHA');
            if (hasHcaptcha) blockType.push('HCAPTCHA');
            if (hasBlocking) blockType.push('IP_BLOCK');
            
            console.log(`[DebugRunner] ⚠️ PROTEÇÃO DETECTADA: ${blockType.join(', ')} na página ${brokerName}`);
            const screenshot2 = await this.page.screenshot({ fullPage: true });
            const screenshot2Base64 = screenshot2.toString('base64');
            console.log(`[DebugRunner] Screenshot da proteção salvo (${screenshot2Base64.length} chars)`);
            
            // Aguardar um pouco para ver se a proteção se resolve sozinha
            console.log(`[DebugRunner] Aguardando 10 segundos para resolução automática...`);
            await this.page.waitForTimeout(10000);
            
            // Verificar se mudou
            const newUrl = this.page.url();
            const newTitle = await this.page.title();
            console.log(`[DebugRunner] Após espera - URL: "${newUrl}", Título: "${newTitle}"`);
          }

          // Seletores específicos para cada broker
          let emailSelectors: string[] = [];
          let passwordSelectors: string[] = [];
          let loginButtons: string[] = [];

          if (broker === 'quotex') {
            emailSelectors = [
              'input[type="email"]',
              'input[name="email"]',
              'input[placeholder*="email" i]',
              '.email input',
              '#email'
            ];
            passwordSelectors = [
              'input[type="password"]', 
              'input[name="password"]',
              '.password input',
              '#password'
            ];
            loginButtons = [
              'button[type="submit"]',
              'input[type="submit"]',
              'button:has-text("Entrar")',
              'button:has-text("Login")',
              '.login-btn'
            ];
          } else if (broker === 'iqoption') {
            emailSelectors = [
              'input[name="email"]',
              'input[type="email"]',
              'input[placeholder*="e-mail" i]',
              'input[data-test="email"]'
            ];
            passwordSelectors = [
              'input[name="password"]',
              'input[type="password"]',
              'input[data-test="password"]'
            ];
            loginButtons = [
              'button[type="submit"]',
              'button[data-test="submit"]',
              'input[type="submit"]',
              'button:has-text("Login")',
              'button:has-text("Entrar")'
            ];
          } else if (broker === 'exnova') {
            emailSelectors = [
              'input[placeholder*="e-mail" i]',
              'input[name="email"]',
              'input[type="email"]'
            ];
            passwordSelectors = [
              'input[name="password"]',
              'input[type="password"]'
            ];
            loginButtons = [
              'button[type="submit"]',
              'input[type="submit"]',
              'button:has-text("Login")',
              'button:has-text("Entrar")'
            ];
          }

          let emailInput = null;
          let passwordInput = null;

          // Encontrar campo de email
          for (const selector of emailSelectors) {
            try {
              emailInput = await this.page.$(selector);
              if (emailInput) {
                console.log(`[DebugRunner] Campo email encontrado com seletor: ${selector}`);
                break;
              }
            } catch (e) {
              console.log(`[DebugRunner] Seletor email ${selector} não funcionou`);
            }
          }

          // Encontrar campo de password
          for (const selector of passwordSelectors) {
            try {
              passwordInput = await this.page.$(selector);
              if (passwordInput) {
                console.log(`[DebugRunner] Campo password encontrado com seletor: ${selector}`);
                break;
              }
            } catch (e) {
              console.log(`[DebugRunner] Seletor password ${selector} não funcionou`);
            }
          }

          if (emailInput && passwordInput) {
            console.log('[DebugRunner] Preenchendo credenciais...');
            
            // Screenshot antes de preencher
            const screenshotBefore = await this.page.screenshot({ fullPage: true });
            console.log(`[DebugRunner] Screenshot antes de preencher (${screenshotBefore.toString('base64').length} chars)`);
            
            // Preencher email
            console.log('[DebugRunner] Preenchendo email...');
            await emailInput.fill(email);
            await this.page.waitForTimeout(1000);
            
            // Preencher senha
            console.log('[DebugRunner] Preenchendo senha...');
            await passwordInput.fill(password);
            await this.page.waitForTimeout(1000);

            // Screenshot após preencher
            const screenshotAfter = await this.page.screenshot({ fullPage: true });
            console.log(`[DebugRunner] Screenshot após preencher (${screenshotAfter.toString('base64').length} chars)`);

            // Procurar botão de login usando os seletores específicos

            let loginButton = null;
            for (const selector of loginButtons) {
              try {
                loginButton = await this.page.$(selector);
                if (loginButton) {
                  console.log(`[DebugRunner] Botão login encontrado para ${brokerName}: ${selector}`);
                  break;
                }
              } catch (e) {
                console.log(`[DebugRunner] Botão ${selector} não encontrado para ${brokerName}`);
              }
            }

            if (loginButton) {
              console.log('[DebugRunner] Clicando no botão de login...');
              await loginButton.click();
              
              // Aguardar redirecionamento ou erro
              await this.page.waitForTimeout(5000);
              
              const currentUrl = this.page.url();
              console.log(`[DebugRunner] URL atual após login: ${currentUrl}`);

              // Screenshot após tentar login
              const screenshotLogin = await this.page.screenshot({ fullPage: true });
              console.log(`[DebugRunner] Screenshot após login (${screenshotLogin.toString('base64').length} chars)`);

              // Verificar se login deu certo (mudança de URL ou elementos específicos)
              let loginSuccess = false;
              
              if (broker === 'quotex') {
                loginSuccess = currentUrl.includes('trade') || currentUrl.includes('dashboard') || currentUrl.includes('qxbroker.com/pt/trade');
              } else if (broker === 'iqoption') {
                loginSuccess = currentUrl.includes('iqoption.com/traderoom') || currentUrl.includes('platform') || currentUrl.includes('trading');
              } else if (broker === 'exnova') {
                loginSuccess = currentUrl.includes('trade') || currentUrl.includes('trading') || currentUrl.includes('dashboard');
              }
              
              if (loginSuccess) {
                console.log(`[DebugRunner] ✅ Login ${brokerName} realizado com sucesso!`);
                
                // Aguardar um pouco para capturar o estado final
                console.log(`[DebugRunner] 🕐 Aguardando estado final do ${brokerName}...`);
                await this.page.waitForTimeout(5000);
                
                const screenshotFinal = await this.page.screenshot({ fullPage: true });
                console.log(`[DebugRunner] Screenshot final de sucesso ${brokerName} (${screenshotFinal.toString('base64').length} chars)`);
                
                return { success: true, message: `Login ${brokerName} realizado com sucesso - Screenshots capturados nos logs` };
              }
            }
          }

          console.log(`[DebugRunner] Elementos não encontrados nesta URL do ${brokerName}, tentando próxima...`);
          
        } catch (error) {
          console.error(`[DebugRunner] Erro com URL ${url} do ${brokerName}:`, error);
          continue;
        }
      }

      return { success: false, message: `Não foi possível realizar o login do ${brokerName} em nenhuma URL. Verifique os logs para detalhes das proteções detectadas.` };

    } catch (error) {
      console.error('[DebugRunner] Erro geral:', error);
      return { success: false, message: `Erro: ${error}` };
    }
  }

  async close(): Promise<void> {
    try {
      if (this.page) await this.page.close();
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
    } catch (error) {
      console.error('[DebugRunner] Erro ao fechar:', error);
    }
  }
}

export const debugRunner = () => new DebugRunner();
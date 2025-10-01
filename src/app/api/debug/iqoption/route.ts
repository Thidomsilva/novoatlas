import { NextRequest, NextResponse } from 'next/server';
import { iqOptionRunner } from '@/lib/brokers/iqOptionRunner';

export async function GET() {
  return POST({} as NextRequest);
}

export async function POST(req: NextRequest) {
  console.log('🐛 [Debug IQ Option] Iniciando debug dos seletores...');
  
  try {
    const body = await req.json().catch(() => ({}));
    const { action = 'analyze' } = body as { action?: string };
    
    console.log('🔧 [Debug IQ Option] Criando runner...');
    const runner = iqOptionRunner();
    
    try {
      console.log('� [Debug IQ Option] Analisando página atual...');
      
      // Usar o método start() em vez do debugRunner
      await runner.start();
      
      // Obter referência da página
      const page = (runner as any).page;
      if (!page) {
        return NextResponse.json({ 
          success: false, 
          message: 'Navegador não iniciado corretamente' 
        }, { status: 500 });
      }
      
      // Analisar elementos da página
      const pageInfo = await page.evaluate(() => {
        const selectors = [
          '[data-test-id="balance"]',
          '.balance',
          '[class*="balance"]',
          '[data-testid*="balance"]',
          '[data-test-id="user-menu"]',
          '.user-menu',
          '.trading-panel',
          '.header-user',
          '.header',
          '.topbar',
          '.sidebar',
          '[class*="user"]',
          '[class*="User"]',
          '[class*="Balance"]',
          '[data-qa*="balance"]'
        ];
        
        const found = [];
        const allElements = [];
        
        // Procurar pelos seletores conhecidos
        for (const selector of selectors) {
          try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              found.push({
                selector,
                count: elements.length,
                texts: Array.from(elements).map(el => el.textContent?.trim()).slice(0, 3)
              });
            }
          } catch (e) {}
        }
        
        // Procurar elementos que contenham números (possíveis saldos)
        const numberElements = document.querySelectorAll('*');
        for (const el of Array.from(numberElements)) {
          const text = el.textContent?.trim() || '';
          const hasNumber = /\$?\d{1,3}(,\d{3})*(\.\d{2})?|\d+[\.,]\d{2}/.test(text);
          const isLikelyBalance = text.length < 50 && hasNumber && 
            (text.includes('$') || text.includes('€') || text.includes('R$') || 
             /^\d+[\.,]\d{2}$/.test(text) || /^\$\d/.test(text));
          
          if (isLikelyBalance && allElements.length < 20) {
            const classes = el.className || '';
            const id = el.id || '';
            const tagName = el.tagName.toLowerCase();
            allElements.push({
              text,
              tagName,
              classes,
              id,
              selector: `${tagName}${id ? `#${id}` : ''}${classes ? `.${classes.split(' ').join('.')}` : ''}`
            });
          }
        }
        
        return {
          url: window.location.href,
          title: document.title,
          foundSelectors: found,
          possibleBalances: allElements,
          timestamp: new Date().toISOString()
        };
      });
      
      console.log('✅ [Debug IQ Option] Análise concluída:', pageInfo);
      
      return NextResponse.json({
        success: true,
        analysis: pageInfo
      });
      
    } catch (e: any) {
      console.error('❌ [Debug IQ Option] Erro na análise:', e);
      
      return NextResponse.json({ 
        success: false, 
        message: `Erro no debug IQ Option: ${e.message || e}` 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('💥 [Debug Runner IQ Option] Erro geral:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    }, { status: 500 });
  }
}
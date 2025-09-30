import { NextRequest, NextResponse } from 'next/server';
import { tradingBrowserRunner } from '@/lib/brokers/tradingBrowserRunner';

export async function POST(req: NextRequest) {
  console.log('🖥️ [Visual Debug] Iniciando sessão de debug visual...');
  
  try {
    const body = await req.json().catch(() => ({}));
    const { broker = 'exnova', email, password } = body as { 
      broker?: 'quotex' | 'iqoption' | 'exnova'; 
      email?: string; 
      password?: string; 
    };
    
    console.log('🎯 [Visual Debug] Broker selecionado:', broker);
    console.log('🌐 [Visual Debug] Modo visual remoto ativo - acesse via noVNC');
    
    const runner = tradingBrowserRunner();
    
    try {
      // Executar com navegador VISUAL no servidor
      if (!email || !password) {
        return NextResponse.json({ 
          success: false, 
          message: 'Email e senha são obrigatórios para debug visual' 
        }, { status: 400 });
      }
      
      const result = await runner.connectAndPrepareVisual(broker, email, password);
      
      return NextResponse.json({
        success: true,
        message: 'Sessão de debug visual iniciada! Acesse http://novoatlas.fly.dev:6080/vnc.html para ver o navegador',
        vncUrl: 'http://novoatlas.fly.dev:6080/vnc.html',
        result
      });
      
    } catch (e: any) {
      console.error('❌ [Visual Debug] Erro na sessão:', e);
      return NextResponse.json({ 
        success: false, 
        message: `Erro na sessão de debug: ${e.message}`,
        vncUrl: 'http://novoatlas.fly.dev:6080/vnc.html'
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ [Visual Debug] Erro geral:', error);
    return NextResponse.json({ 
      success: false, 
      message: `Erro no debug visual: ${error}` 
    }, { status: 500 });
  }
}
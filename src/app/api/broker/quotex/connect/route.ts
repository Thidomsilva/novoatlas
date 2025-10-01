import { NextRequest, NextResponse } from 'next/server';
import { tradingBrowserRunner } from '@/lib/brokers/tradingBrowserRunner';
import { quotexRunner } from '@/lib/brokers/quotexRunner';

export async function POST(req: NextRequest) {
  console.log('🚀 [Quotex Connect] Conectando para operação em tempo real...');
  
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password } = (body || {}) as { email?: string; password?: string };
    
    if (!email || !password) {
      return NextResponse.json({ 
        success: false, 
        message: 'Email e senha são obrigatórios',
        isLoggedIn: false
      }, { status: 400 });
    }
    
    console.log('🔧 [Quotex Connect] Iniciando conexão de trading...');
    const runner = tradingBrowserRunner();
    
    try {
      console.log('🎯 [Quotex Connect] Conectando e preparando para operação...');
      const result = await runner.connectAndPrepare('quotex', email, password);
      
      console.log('✅ [Quotex Connect] Resultado da conexão:', result);
      
      if (result.success && result.isReady) {
        // Manter runner ativo em memória para operação contínua
        console.log('🔄 [Quotex Connect] Quotex pronto e mantido ativo para sinais...');
        
        return NextResponse.json({
          success: true,
          isLoggedIn: true,
          isReady: result.isReady,
          message: result.message,
          balance: await quotexRunner().getBalance().catch(() => undefined),
          broker: 'Quotex'
        });
      } else {
        await runner.close();
        return NextResponse.json({ 
          success: false, 
          isLoggedIn: false,
          isReady: false,
          message: result.message 
        }, { status: 500 });
      }
      
    } catch (e: any) {
      console.error('❌ [Quotex Connect] Erro na conexão:', e);
      
      return NextResponse.json({ 
        success: false, 
        isLoggedIn: false,
        isReady: false,
        message: `Erro na conexão Quotex: ${e.message || e}` 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('💥 [Quotex Connect] Erro geral:', error);
    return NextResponse.json({ 
      success: false, 
      isLoggedIn: false,
      isReady: false,
      message: 'Erro interno do servidor' 
    }, { status: 500 });
  }
}
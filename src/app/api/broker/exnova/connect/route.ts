import { NextRequest, NextResponse } from 'next/server';
import { tradingBrowserRunner } from '@/lib/brokers/tradingBrowserRunner';
import { exnovaRunner } from '@/lib/brokers/exnovaRunner';

export async function POST(req: NextRequest) {
  console.log('🚀 [Exnova Connect] Conectando para operação em tempo real...');
  
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
    
    console.log('🔧 [Exnova Connect] Iniciando conexão de trading...');
    const runner = tradingBrowserRunner();
    
    try {
      console.log('🎯 [Exnova Connect] Conectando e preparando para operação...');
      const result = await runner.connectAndPrepare('exnova', email, password);
      
      console.log('✅ [Exnova Connect] Resultado da conexão:', result);
      
      if (result.success && result.isReady) {
        console.log('🔄 [Exnova Connect] Exnova pronto e mantido ativo para sinais...');
        
        return NextResponse.json({
          success: true,
          isLoggedIn: true,
          isReady: result.isReady,
          message: result.message,
          balance: await exnovaRunner().getBalance().catch(() => undefined),
          broker: 'Exnova'
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
      console.error('❌ [Exnova Connect] Erro na conexão:', e);
      
      return NextResponse.json({ 
        success: false, 
        isLoggedIn: false,
        isReady: false,
        message: `Erro na conexão Exnova: ${e.message || e}` 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('💥 [Exnova Connect] Erro geral:', error);
    return NextResponse.json({ 
      success: false, 
      isLoggedIn: false,
      isReady: false,
      message: 'Erro interno do servidor' 
    }, { status: 500 });
  }
}
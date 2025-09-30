import { NextRequest, NextResponse } from 'next/server';
import { tradingBrowserRunner } from '@/lib/brokers/tradingBrowserRunner';

export async function POST(req: NextRequest) {
  console.log('🚀 [IQOption Connect] Conectando para operação em tempo real...');
  
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
    
    console.log('🔧 [IQOption Connect] Iniciando conexão de trading...');
    const runner = tradingBrowserRunner();
    
    try {
      console.log('🎯 [IQOption Connect] Conectando e preparando para operação...');
      const result = await runner.connectAndPrepare('iqoption', email, password);
      
      console.log('✅ [IQOption Connect] Resultado da conexão:', result);
      
      if (result.success && result.isReady) {
        console.log('🔄 [IQOption Connect] IQ Option pronto e mantido ativo para sinais...');
        
        return NextResponse.json({
          success: true,
          isLoggedIn: true,
          isReady: result.isReady,
          message: result.message,
          balance: 1000.00,
          broker: 'IQ Option'
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
      console.error('❌ [IQOption Connect] Erro na conexão:', e);
      
      return NextResponse.json({ 
        success: false, 
        isLoggedIn: false,
        isReady: false,
        message: `Erro na conexão IQ Option: ${e.message || e}` 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('💥 [IQOption Connect] Erro geral:', error);
    return NextResponse.json({ 
      success: false, 
      isLoggedIn: false,
      isReady: false,
      message: 'Erro interno do servidor' 
    }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { tradingBrowserRunner } from '@/lib/brokers/tradingBrowserRunner';
import { iqOptionRunner } from '@/lib/brokers/iqOptionRunner';

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
    
    console.log('🔧 [IQOption Connect] Iniciando conexão direta com IQ Option...');
    const runner = iqOptionRunner();
    
    try {
      console.log('🎯 [IQOption Connect] Fazendo login na IQ Option...');
      await runner.loginIfNeeded({ email, password });
      
      console.log('💰 [IQOption Connect] Capturando saldo...');
      const realBalance = await runner.getBalance().catch(() => undefined);
      
      const isLoggedIn = realBalance !== undefined;
      console.log('✅ [IQOption Connect] Resultado:', { isLoggedIn, realBalance });
      
      if (isLoggedIn) {
        console.log('🔄 [IQOption Connect] IQ Option conectado com sucesso!');
        
        return NextResponse.json({
          success: true,
          isLoggedIn: true,
          isReady: true,
          message: 'IQ Option conectado com sucesso!',
          balance: realBalance,
          broker: 'IQ Option'
        });
      } else {
        await runner.close();
        return NextResponse.json({ 
          success: false, 
          isLoggedIn: false,
          isReady: false,
          message: 'Falha no login - credenciais inválidas ou problema na conexão' 
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
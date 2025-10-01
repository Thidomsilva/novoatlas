import { NextRequest, NextResponse } from 'next/server';
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
    
    console.log('🔧 [Exnova Connect] Iniciando conexão direta com Exnova...');
    const runner = exnovaRunner();
    
    try {
      console.log('🎯 [Exnova Connect] Fazendo login na Exnova...');
      await runner.loginIfNeeded({ email, password });
      
      console.log('💰 [Exnova Connect] Capturando saldo...');
      const balance = await runner.getBalance().catch(() => undefined);
      
      const isLoggedIn = balance !== undefined;
      console.log('✅ [Exnova Connect] Resultado:', { isLoggedIn, balance });
      
      if (isLoggedIn) {
        console.log('🔄 [Exnova Connect] Exnova pronto e mantido ativo para sinais...');
        
        return NextResponse.json({
          success: true,
          isLoggedIn: true,
          isReady: true,
          message: 'Exnova conectado com sucesso!',
          balance: balance,
          broker: 'Exnova'
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

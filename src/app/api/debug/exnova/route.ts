import { NextRequest, NextResponse } from 'next/server';
import { debugRunner } from '@/lib/brokers/debugRunner';

export async function POST(req: NextRequest) {
  console.log('🐛 [Debug Runner Exnova] Iniciando modo DEBUG com navegador...');
  
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password } = (body || {}) as { email?: string; password?: string };
    
    if (!email || !password) {
      return NextResponse.json({ 
        success: false, 
        message: 'Email e senha são obrigatórios para modo debug' 
      }, { status: 400 });
    }
    
    console.log('🔧 [Debug Runner Exnova] Criando runner debug...');
    const runner = debugRunner();
    
    try {
      console.log('🔐 [Debug Runner Exnova] Tentando login debug...');
      const result = await runner.loginBroker('exnova', email, password);
      
      console.log('✅ [Debug Runner Exnova] Resultado:', result);
      
      // Fechar runner após um tempo
      setTimeout(async () => {
        console.log('🔒 [Debug Runner Exnova] Fechando navegador...');
        await runner.close();
      }, 10000); // 10 segundos
      
      return NextResponse.json(result);
      
    } catch (e: any) {
      console.error('❌ [Debug Runner Exnova] Erro no login:', e);
      
      await runner.close();
      
      return NextResponse.json({ 
        success: false, 
        message: `Erro no debug Exnova: ${e.message || e}` 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('💥 [Debug Runner Exnova] Erro geral:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    }, { status: 500 });
  }
}
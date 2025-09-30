import { NextRequest, NextResponse } from 'next/server';
import { debugRunner } from '@/lib/brokers/debugRunner';

export async function POST(req: NextRequest) {
  console.log('🐛 [Debug Runner] Iniciando modo DEBUG com navegador visual...');
  
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password } = (body || {}) as { email?: string; password?: string };
    
    if (!email || !password) {
      return NextResponse.json({ 
        success: false, 
        message: 'Email e senha são obrigatórios para modo debug' 
      }, { status: 400 });
    }
    
    console.log('🔧 [Debug Runner] Criando runner visual...');
    const runner = debugRunner();
    
    try {
      console.log('🔐 [Debug Runner] Tentando login visual...');
      const result = await runner.loginBroker('quotex', email, password);
      
      console.log('✅ [Debug Runner] Resultado:', result);
      
      // Fechar runner após um tempo
      setTimeout(async () => {
        console.log('🔒 [Debug Runner] Fechando navegador...');
        await runner.close();
      }, 35000); // 35 segundos
      
      return NextResponse.json(result);
      
    } catch (e: any) {
      console.error('❌ [Debug Runner] Erro no login:', e);
      
      await runner.close();
      
      return NextResponse.json({ 
        success: false, 
        message: `Erro no debug: ${e.message || e}` 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('💥 [Debug Runner] Erro geral:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    }, { status: 500 });
  }
}
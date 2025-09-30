import { NextRequest, NextResponse } from 'next/server';
import { localBrowserRunner } from '@/lib/brokers/localBrowserRunner';

export async function POST(req: NextRequest) {
  console.log('🖥️ [Local Browser] Iniciando navegador VISUAL local...');
  
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password, broker } = (body || {}) as { 
      email?: string; 
      password?: string; 
      broker?: 'quotex' | 'iqoption' | 'exnova'; 
    };
    
    if (!email || !password || !broker) {
      return NextResponse.json({ 
        success: false, 
        message: 'Email, senha e broker são obrigatórios' 
      }, { status: 400 });
    }
    
    console.log(`🔧 [Local Browser] Abrindo ${broker.toUpperCase()} localmente...`);
    const runner = localBrowserRunner();
    
    try {
      console.log(`🌐 [Local Browser] Iniciando ${broker}...`);
      const result = await runner.loginBrokerLocal(broker, email, password);
      
      console.log('✅ [Local Browser] Resultado:', result);
      
      // NÃO fechar - manter aberto para operação
      console.log('🔄 [Local Browser] Navegador mantido aberto para operação contínua...');
      
      return NextResponse.json(result);
      
    } catch (e: any) {
      console.error(`❌ [Local Browser] Erro no ${broker}:`, e);
      
      return NextResponse.json({ 
        success: false, 
        message: `Erro no navegador ${broker}: ${e.message || e}` 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('💥 [Local Browser] Erro geral:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Erro interno do servidor' 
    }, { status: 500 });
  }
}
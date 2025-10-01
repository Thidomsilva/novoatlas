import { NextRequest, NextResponse } from 'next/server';
import { exnovaRunner } from '@/lib/brokers/exnovaRunner';

export async function POST(req: NextRequest) {
  console.log('🚀 [Exnova Login API] Iniciando processo de login...');
  
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password } = (body || {}) as { email?: string; password?: string };
    
    console.log('📝 [Exnova Login API] Credenciais recebidas:', { 
      email: email ? `${email.substring(0, 3)}***` : 'undefined',
      password: password ? '***fornecida***' : 'undefined'
    });
    
    console.log('🔧 [Exnova Login API] Criando runner...');
    const runner = exnovaRunner();
    
    try {
      console.log('🔐 [Exnova Login API] Tentando login...');
      await runner.loginIfNeeded({ email, password });
      console.log('✅ [Exnova Login API] Login realizado com sucesso!');
      
    } catch (e: any) {
      console.error('❌ [Exnova Login API] Erro no login:', e);
      
      const msg = String(e?.message || e);
      if (/Missing EXNOVA_EMAIL\/EXNOVA_PASSWORD/i.test(msg)) {
        console.log('⚠️ [Exnova Login API] Credenciais ausentes');
        return NextResponse.json(
          { error: 'Credenciais ausentes. Preencha e-mail/senha ou defina EXNOVA_EMAIL e EXNOVA_PASSWORD no servidor.' },
          { status: 400 }
        );
      }
      throw e;
    }
    
    console.log('💰 [Exnova Login API] Buscando saldo...');
    const balance = await runner.getBalance();
    console.log('✅ [Exnova Login API] Processo finalizado com sucesso!', { balance });
    
    return NextResponse.json({ isLoggedIn: true, balance });
    
  } catch (e: any) {
    console.error('💥 [Exnova Login API] Erro geral:', {
      message: e?.message,
      stack: e?.stack,
      name: e?.name
    });
    
    return NextResponse.json({ 
      error: e?.message || 'login failed',
      details: process.env.NODE_ENV === 'development' ? e?.stack : undefined 
    }, { status: 500 });
  }
}
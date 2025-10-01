import { NextRequest, NextResponse } from 'next/server';
import { quotexRunner } from '@/lib/brokers/quotexRunner';

export async function POST(req: NextRequest) {
  console.log('🚀 [Quotex Login] Iniciando processo de login...');
  
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password } = (body || {}) as { email?: string; password?: string };
    
    console.log('📝 [Quotex Login] Credenciais recebidas:', { 
      email: email ? `${email.substring(0, 3)}***` : 'undefined',
      password: password ? '***fornecida***' : 'undefined'
    });
    
    console.log('🔧 [Quotex Login] Criando runner...');
    const runner = quotexRunner();
    
    try {
      console.log('🔐 [Quotex Login] Tentando login...');
      await runner.loginIfNeeded({ email, password });
      console.log('✅ [Quotex Login] Login realizado com sucesso!');
      
    } catch (e: any) {
      console.error('❌ [Quotex Login] Erro no login:', e);
      
      const msg = String(e?.message || e);
      if (/Missing QUOTEX_EMAIL\/QUOTEX_PASSWORD/i.test(msg)) {
        console.log('⚠️ [Quotex Login] Credenciais ausentes');
        return NextResponse.json(
          { error: 'Credenciais ausentes. Preencha e-mail/senha ou defina QUOTEX_EMAIL e QUOTEX_PASSWORD no servidor.' },
          { status: 400 }
        );
      }
      throw e;
    }
    
    console.log('💰 [Quotex Login] Buscando saldo...');
    const balance = await runner.getBalance();
    console.log('✅ [Quotex Login] Processo finalizado com sucesso!', { balance });
    
    return NextResponse.json({ isLoggedIn: true, balance });
    
  } catch (e: any) {
    console.error('💥 [Quotex Login] Erro geral:', {
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

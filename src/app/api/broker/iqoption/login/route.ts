import { NextRequest, NextResponse } from 'next/server';
import { iqOptionRunner } from '@/lib/brokers/iqOptionRunner';

export async function POST(req: NextRequest) {
  console.log('🚀 [IQOption Login] Iniciando processo de login...');
  
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password } = (body || {}) as { email?: string; password?: string };
    
    console.log('📝 [IQOption Login] Credenciais recebidas:', { 
      email: email ? `${email.substring(0, 3)}***` : 'undefined',
      password: password ? '***fornecida***' : 'undefined'
    });
    
    console.log('🔧 [IQOption Login] Criando runner...');
    const runner = iqOptionRunner();
    
    try {
      console.log('🔐 [IQOption Login] Tentando login...');
      await runner.loginIfNeeded({ email, password });
      console.log('✅ [IQOption Login] Login realizado com sucesso!');
      
    } catch (e: any) {
      console.error('❌ [IQOption Login] Erro no login:', e);
      
      const msg = String(e?.message || e);
      if (/Missing IQOPTION_EMAIL\/IQOPTION_PASSWORD/i.test(msg)) {
        console.log('⚠️ [IQOption Login] Credenciais ausentes');
        return NextResponse.json(
          { error: 'Credenciais ausentes. Preencha e-mail/senha ou defina IQOPTION_EMAIL e IQOPTION_PASSWORD no servidor.' },
          { status: 400 }
        );
      }
      throw e;
    }
    
    console.log('💰 [IQOption Login] Buscando saldo...');
    const balance = await runner.getBalance();
    console.log('✅ [IQOption Login] Processo finalizado com sucesso!', { balance });
    
    return NextResponse.json({ isLoggedIn: true, balance });
    
  } catch (e: any) {
    console.error('💥 [IQOption Login] Erro geral:', {
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
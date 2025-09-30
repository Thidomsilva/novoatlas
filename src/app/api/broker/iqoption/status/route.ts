import { NextRequest, NextResponse } from 'next/server';
import { iqOptionRunner } from '@/lib/brokers/iqOptionRunner';

export async function GET(_req: NextRequest) {
  try {
    console.log('🔍 [IQOption Status] Verificando status...');
    const runner = iqOptionRunner();
    
    const balance = await runner.getBalance().catch(() => undefined);
    const isLoggedIn = balance !== undefined;
    
    console.log('✅ [IQOption Status] Status verificado:', { isLoggedIn, balance });
    
    return NextResponse.json({ 
      isLoggedIn,
      balance,
      broker: 'iqoption',
      timestamp: new Date().toISOString()
    });
  } catch (e: any) {
    console.error('❌ [IQOption Status] Erro ao verificar status:', e);
    
    return NextResponse.json({ 
      isLoggedIn: false,
      error: e?.message || 'status check failed',
      broker: 'iqoption'
    }, { status: 500 });
  }
}
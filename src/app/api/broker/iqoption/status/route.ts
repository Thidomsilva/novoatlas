import { NextRequest, NextResponse } from 'next/server';
import { iqOptionRunner } from '@/lib/brokers/iqOptionRunner';

export async function GET(_req: NextRequest) {
  console.log('🚨 [IQOption Status] ======= INÍCIO DO TESTE REAL =======');
  
  try {
    console.log('🔍 [IQOption Status] Criando runner...');
    const runner = iqOptionRunner();
    console.log('✅ [IQOption Status] Runner criado');
    
    console.log('💰 [IQOption Status] Tentando capturar saldo...');
    const balance = await runner.getBalance().catch((error) => {
      console.error('❌ [IQOption Status] ERRO ao capturar saldo:', error);
      return undefined;
    });
    
    const isLoggedIn = balance !== undefined && balance !== null;
    
    console.log('📊 [IQOption Status] Resultado final:', { 
      isLoggedIn, 
      balance,
      balanceType: typeof balance,
      balanceIsNaN: isNaN(Number(balance))
    });
    
    // Retornar sempre com logs claros
    const result = {
      isLoggedIn,
      balance,
      broker: 'iqoption',
      timestamp: new Date().toISOString(),
      debug: {
        balanceType: typeof balance,
        balanceValue: balance,
        isNaN: isNaN(Number(balance))
      }
    };
    
    console.log('📤 [IQOption Status] Enviando resposta:', result);
    
    return NextResponse.json(result);
    
  } catch (e: any) {
    console.error('💥 [IQOption Status] ERRO CRÍTICO:', e);
    console.error('💥 [IQOption Status] Stack trace:', e?.stack);
    
    const errorResponse = {
      isLoggedIn: false,
      error: e?.message || 'status check failed',
      broker: 'iqoption',
      timestamp: new Date().toISOString(),
      debug: {
        errorType: typeof e,
        errorMessage: e?.message,
        errorStack: e?.stack?.substring(0, 500)
      }
    };
    
    console.log('📤 [IQOption Status] Enviando erro:', errorResponse);
    
    return NextResponse.json(errorResponse, { status: 500 });
  } finally {
    console.log('🚨 [IQOption Status] ======= FIM DO TESTE =======');
  }
}
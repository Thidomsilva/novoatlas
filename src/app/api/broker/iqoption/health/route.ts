import { NextRequest, NextResponse } from 'next/server';
import { iqOptionRunner } from '@/lib/brokers/iqOptionRunner';

export async function GET(_req: NextRequest) {
  try {
    const runner = iqOptionRunner();
    const balance = await runner.getBalance().catch(() => undefined);
    const isLoggedIn = balance !== undefined;
    
    return NextResponse.json({ 
      ok: true, 
      pageReady: true, 
      balance,
      isLoggedIn,
      broker: 'iqoption'
    });
  } catch (e: any) {
    return NextResponse.json({ 
      ok: false, 
      error: e?.message || 'health-failed',
      broker: 'iqoption'
    }, { status: 500 });
  }
}
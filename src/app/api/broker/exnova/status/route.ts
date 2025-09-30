import { NextRequest, NextResponse } from 'next/server';
import { exnovaRunner } from '@/lib/brokers/exnovaRunner';

export async function GET(_req: NextRequest) {
  try {
    const runner = exnovaRunner();
    const balance = await runner.getBalance();
    
    if (balance !== undefined) {
      return NextResponse.json({ 
        isConnected: true, 
        isLoggedIn: true, 
        balance 
      });
    } else {
      return NextResponse.json({ 
        isConnected: false, 
        isLoggedIn: false 
      });
    }
  } catch (e: any) {
    console.error('Exnova status error:', e);
    return NextResponse.json({ 
      isConnected: false, 
      isLoggedIn: false, 
      error: e?.message || 'status check failed' 
    }, { status: 500 });
  }
}
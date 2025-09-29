import { NextRequest, NextResponse } from 'next/server';
import { quotexRunner } from '@/lib/brokers/quotexRunner';

export async function GET(_req: NextRequest) {
  try {
    const runner = quotexRunner();
    const balance = await runner.getBalance();
    const isLoggedIn = typeof balance === 'number';
    return NextResponse.json({ isLoggedIn, balance });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'status failed' }, { status: 500 });
  }
}

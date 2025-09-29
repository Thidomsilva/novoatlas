import { NextRequest, NextResponse } from 'next/server';
import { quotexRunner } from '@/lib/brokers/quotexRunner';

export async function GET(_req: NextRequest) {
  try {
    const runner = quotexRunner();
    // getBalance já inicializa o contexto via start() internamente
    const balance = await runner.getBalance().catch(() => undefined);
    return NextResponse.json({ ok: true, pageReady: true, balance });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'health-failed' }, { status: 500 });
  }
}

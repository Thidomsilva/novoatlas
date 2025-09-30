import { NextRequest, NextResponse } from 'next/server';
import { exnovaRunner } from '@/lib/brokers/exnovaRunner';

export async function GET(_req: NextRequest) {
  try {
    const runner = exnovaRunner();
    const balance = await runner.getBalance().catch(() => undefined);
    return NextResponse.json({ ok: true, pageReady: true, balance });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'health-failed' }, { status: 500 });
  }
}
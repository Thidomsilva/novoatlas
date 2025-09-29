import { NextRequest, NextResponse } from 'next/server';
import { quotexRunner } from '@/lib/brokers/quotexRunner';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { side, stake, expiration_sec } = body || {};
    if (!side || !stake || !expiration_sec) {
      return NextResponse.json({ error: 'Missing side/stake/expiration_sec' }, { status: 400 });
    }
    const runner = quotexRunner();
    const result = await runner.placeOrder({ side, stake: Number(stake), expiration_sec });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'order failed' }, { status: 500 });
  }
}

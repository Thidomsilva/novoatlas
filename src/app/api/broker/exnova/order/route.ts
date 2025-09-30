import { NextRequest, NextResponse } from 'next/server';
import { exnovaRunner } from '@/lib/brokers/exnovaRunner';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { side, stake, expiration_sec } = body as {
      side: 'CALL' | 'PUT';
      stake: number;
      expiration_sec: 30 | 60 | 120;
    };

    if (!side || !stake || !expiration_sec) {
      return NextResponse.json(
        { error: 'Missing required fields: side, stake, expiration_sec' },
        { status: 400 }
      );
    }

    const runner = exnovaRunner();
    const result = await runner.placeOrder({ side, stake, expiration_sec });

    return NextResponse.json(result);
  } catch (e: any) {
    console.error('Exnova order error:', e);
    return NextResponse.json(
      { error: e?.message || 'order failed' },
      { status: 500 }
    );
  }
}
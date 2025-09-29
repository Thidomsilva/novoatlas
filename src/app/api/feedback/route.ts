import { NextRequest, NextResponse } from 'next/server';

const QUANT_API_URL = process.env.QUANT_API_URL || 'http://localhost:7070';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const r = await fetch(`${QUANT_API_URL}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const text = await r.text();
    return new NextResponse(text, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'text/plain' } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'internal error' }, { status: 500 });
  }
}

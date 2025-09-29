import { NextRequest, NextResponse } from 'next/server';
import { quotexRunner } from '@/lib/brokers/quotexRunner';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password } = (body || {}) as { email?: string; password?: string };
    const runner = quotexRunner();
    try {
      await runner.loginIfNeeded({ email, password });
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (/Missing QUOTEX_EMAIL\/QUOTEX_PASSWORD/i.test(msg)) {
        return NextResponse.json(
          { error: 'Credenciais ausentes. Preencha e-mail/senha ou defina QUOTEX_EMAIL e QUOTEX_PASSWORD no servidor.' },
          { status: 400 }
        );
      }
      throw e;
    }
    const balance = await runner.getBalance();
    return NextResponse.json({ isLoggedIn: true, balance });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'login failed' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { quotexRunner } from '@/lib/brokers/quotexRunner';
import { getActiveStrategy, mergePolicyHints, pickStakePercentage } from '@/lib/strategy';

type Brain = 'gemini' | 'chatgpt' | 'auto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      brain = 'auto',
      pair,
      tf_sec,
      features,
      session,
      policy_hints,
      stake_absolute,
      stake_percentage,
      min_stake = 1,
    } = body || {};

    if (brain !== 'auto') {
      return NextResponse.json({ error: 'Only brain=auto supported here' }, { status: 400 });
    }

    // Chama o endpoint local /api/predict para manter lógica em um único lugar
    const base = (() => {
        try {
          const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:9002';
          const proto = req.headers.get('x-forwarded-proto') || 'http';
          return `${proto}://${host}`;
        } catch {
          return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
        }
      })();
      const r = await fetch(new URL('/api/predict', base), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brain, pair, tf_sec, features, session, policy_hints }),
    });
    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json({ error: text }, { status: 502 });
    }
  const predict = await r.json();
    const policy = predict?.policy;

    if (!policy?.enter) {
      return NextResponse.json({ predict, executed: false, reason: 'policy-enter-false' });
    }

    const active = await getActiveStrategy();
    const hintsMerged = mergePolicyHints(policy_hints, active?.strategy?.policy_hints);
    const runner = quotexRunner();
    let stake: number | undefined = stake_absolute;
    if (!stake && stake_percentage) {
      const bal = await runner.getBalance();
      if (!bal) return NextResponse.json({ predict, executed: false, error: 'balance-unavailable' }, { status: 400 });
      stake = Math.max(min_stake, Math.floor((bal * stake_percentage) / 100));
    }
    if (!stake && !stake_percentage) {
      const bal = await runner.getBalance();
      const strategyStakePct = pickStakePercentage(active?.strategy);
      if (bal && strategyStakePct) stake = Math.max(min_stake, Math.floor((bal * strategyStakePct) / 100));
    }
    if (!stake) {
      return NextResponse.json({ predict, executed: false, error: 'missing stake' }, { status: 400 });
    }

    const allowed = [30, 60, 120];
    const exp = allowed.includes(Number(policy.expiration_sec)) ? Number(policy.expiration_sec) : 60;
    const side = String(policy.side).toUpperCase() === 'CALL' ? 'CALL' : 'PUT';

    const result = await runner.placeOrder({ side, stake, expiration_sec: exp as 30 | 60 | 120 });
    return NextResponse.json({ predict, executed: true, order: result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'auto-trade-failed' }, { status: 500 });
  }
}

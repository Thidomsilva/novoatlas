import { NextRequest, NextResponse } from 'next/server';

type Candle = { o: number; h: number; l: number; c: number };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const candles: Candle[] = Array.isArray(body?.candles) ? body.candles : [];
    const th = Number(body?.policy_hints?.th_policy ?? 0.6);
    const stake = Number(body?.stake || 1);
    if (!candles.length) return NextResponse.json({ ok: false, error: 'no-candles' }, { status: 400 });

    // Heurística boba para demonstrar: entra quando fechamento sobe 2 vezes seguidas acima da média curta
    let pnl = 0;
    let wins = 0;
    let losses = 0;
    let last3: number[] = [];
    for (let i = 0; i < candles.length - 1; i++) {
      const c = candles[i];
      last3.push(c.c);
      if (last3.length > 3) last3.shift();
      const avg = last3.reduce((a, b) => a + b, 0) / last3.length;
      const momentum = c.c > avg && (last3[1] ?? c.c) <= avg ? 1 : 0; // cruzamento simplificado
      const policyScore = momentum ? 0.7 : 0.5;
      if (policyScore >= th) {
        // aposta de 1 candle adiante
        const next = candles[i + 1];
        const won = next.c >= c.c; // CALL
        if (won) { pnl += stake * 0.87; wins++; } else { pnl -= stake; losses++; }
      }
    }
    const winrate = (wins + losses) ? wins / (wins + losses) : 0;
    return NextResponse.json({ ok: true, metrics: { pnl, wins, losses, winrate } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'backtest-failed' }, { status: 500 });
  }
}

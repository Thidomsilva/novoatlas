import { NextRequest, NextResponse } from 'next/server';
import { getActiveStrategy, mergePolicyHints } from '@/lib/strategy';

type Brain = 'gemini' | 'chatgpt' | 'auto';

type PredictRequest = {
  brain: Brain;
  pair: string;
  tf_sec: number;
  features: Record<string, unknown>;
  session?: {
    wins_row?: number;
    losses_row?: number;
    pnl_day?: number;
    gales_left?: number;
    payout?: number;
  };
  policy_hints?: {
    th_prob?: number;
    th_score?: number;
    th_policy?: number;
  };
};

type GeminiPredictResponse = {
  p_up: number;
  p_down: number;
  uncertainty: number;
  score_g: number;
  conf_signals?: Array<{ name: string; weight: number }>;
  model_version?: string;
};

type Policy = {
  enter: boolean;
  side: 'CALL' | 'PUT';
  expiration_sec: number;
  stake_mult: number;
  gales_allowed: number;
  policy_score: number;
  reason: string;
};

type PredictAutoResponse = Omit<GeminiPredictResponse, 'model_version'> & {
  policy: Policy;
  model_version: { gemini?: string; chatgpt?: string };
};

const QUANT_API_URL = process.env.QUANT_API_URL || 'http://localhost:7070';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PredictRequest;
    const brain = body.brain || 'auto';

    if (brain === 'gemini') {
      const r = await fetch(`${QUANT_API_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const text = await r.text();
        return NextResponse.json({ error: text }, { status: 502 });
      }
      const data = (await r.json()) as GeminiPredictResponse;
      return NextResponse.json(data);
    }

    if (brain === 'chatgpt') {
      const data = await runChatGptPolicyOnly(body);
      return NextResponse.json(data);
    }

    // auto: sempre executa GEMINI (se QUANT_API_URL acessível) e usa CHATGPT para a política
    const r = await fetch(`${QUANT_API_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, brain: 'gemini' }),
    });
    let gemini: GeminiPredictResponse = { p_up: 0.5, p_down: 0.5, uncertainty: 1, score_g: 0, conf_signals: [], model_version: undefined };
    if (r.ok) {
      gemini = (await r.json()) as GeminiPredictResponse;
    }

  // Misturar hints da estratégia ativa (se houver)
  const active = await getActiveStrategy();
  const combinedHints = mergePolicyHints(body.policy_hints, active?.strategy?.policy_hints);
  const policy = await runChatGptPolicyOnly({ ...body, policy_hints: combinedHints, features: summarizeForLLM(body, gemini, active?.strategy) });

    const { model_version: gemVer, ...restGemini } = gemini;
    const resp: PredictAutoResponse = {
      ...restGemini,
      policy: policy.policy,
      model_version: { gemini: gemVer, chatgpt: (policy as any).model_version?.chatgpt },
    };
  return NextResponse.json(resp);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'internal error' }, { status: 500 });
  }
}

function summarizeForLLM(body: PredictRequest, g: GeminiPredictResponse, strategy?: any) {
  // Minimiza payload para o LLM: extrai últimos agregados se presentes ou apenas passa features resumidas
  const { features, session, policy_hints, tf_sec, pair } = body;
  return {
    pair,
    tf_sec,
    indicators: pickIndicators(features),
    last_candles: pickCandles(features, 10),
    gemini: {
      p_up: g.p_up,
      p_down: g.p_down,
      score_g: g.score_g,
      uncertainty: g.uncertainty,
      conf_signals: g.conf_signals?.slice(0, 6),
    },
    session,
    strategy: strategy ? { name: strategy?.name, pairs: strategy?.pairs, rules: strategy?.rules, filters: strategy?.filters } : undefined,
    policy_hints,
  };
}

function pickIndicators(features: Record<string, unknown> | undefined) {
  const f = features || {};
  const get = (k: string) => (typeof (f as any)[k] === 'number' ? (f as any)[k] : undefined);
  return {
    rsi14: get('rsi14'),
    ema9: get('ema9'),
    ema21: get('ema21'),
    ema50: get('ema50'),
    atrz: get('atrz'),
    bbpos: get('bbpos'),
    macd_hist: get('macd_hist'),
  };
}

function pickCandles(features: Record<string, unknown> | undefined, n: number) {
  const f = features || {};
  const arr = Array.isArray((f as any).candles) ? ((f as any).candles as any[]) : [];
  return arr.slice(-n).map(c => ({ o: c.o, h: c.h, l: c.l, c: c.c }));
}

async function runChatGptPolicyOnly(body: PredictRequest) {
  const { isOpenAISelected, getOpenAIModelId } = await import('@/ai/genkit');
  const useOpenAI = isOpenAISelected();
  const modelId = useOpenAI ? getOpenAIModelId() ?? 'gpt-4o-mini' : 'gpt-4o-mini';
  const { default: OpenAI } = await import('openai');

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const system = `You are a trading meta-policy assistant. Classify regime, decide whether to enter and return a strict JSON policy without extra text.`;
  const user = buildPolicyPrompt(body);

  const chat = await client.chat.completions.create({
    model: modelId!,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' as any },
  });

  const content = chat.choices?.[0]?.message?.content || '{}';
  let parsed: any = {};
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = { policy: { enter: false, policy_score: 0, reason: 'invalid-json' } };
  }
  return { ...parsed, model_version: { chatgpt: modelId } };
}

function buildPolicyPrompt(body: PredictRequest) {
  const hints = body.policy_hints || {};
  const th_prob = hints.th_prob ?? 0.58;
  const th_score = hints.th_score ?? 0.1;
  const th_policy = hints.th_policy ?? 0.6;

  return `Context (compact JSON):\n${JSON.stringify(body.features)}\n\nRules: Return a JSON with {policy:{enter, side, expiration_sec, stake_mult, gales_allowed, policy_score, reason}}.
Use thresholds: th_prob=${th_prob}, th_score=${th_score}, th_policy=${th_policy}. Side must be CALL or PUT.`;
}

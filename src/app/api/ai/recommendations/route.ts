import { NextRequest, NextResponse } from 'next/server';
import { isOpenAISelected, getOpenAIModelId, hasOpenAIKey, hasGeminiKey } from '@/ai/genkit';

export async function POST(req: NextRequest) {
  try {
    const { tradingHistory } = await req.json();
    if (typeof tradingHistory !== 'string' || !tradingHistory.trim()) {
      return NextResponse.json({ error: 'tradingHistory inválido' }, { status: 400 });
    }

    // Preferir OpenAI se AI_MODEL=openai/* ou se a chave existir quando AI_MODEL não estiver definido
    if (isOpenAISelected() || (!process.env.AI_MODEL && hasOpenAIKey())) {
      const { default: OpenAI } = await import('openai');
      const modelId = getOpenAIModelId() ?? 'gpt-4o-mini';
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const system = `Você é um especialista em estratégia de trading. Analise o histórico do usuário e recomende configurações de gestão de risco (meta diária, perda máxima, aporte por entrada, confiança mínima da IA). Seja direto.`;
      const user = `Histórico: ${tradingHistory}`;
      const chat = await client.chat.completions.create({
        model: modelId,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.3,
      });
      const text = chat.choices?.[0]?.message?.content ?? 'Sem recomendações disponíveis.';
      return NextResponse.json({ recommendations: text, model: modelId, provider: 'openai' });
    }

    // Fallback: usar flow existente (Genkit/Gemini) se chave existir
    if (hasGeminiKey()) {
      try {
        const { getTradeStrategyRecommendations } = await import('@/ai/flows/trade-strategy-recommendations');
        const out = await getTradeStrategyRecommendations({ tradingHistory });
        const model = process.env.AI_MODEL || 'googleai/gemini-2.5-flash';
        return NextResponse.json({ ...out, provider: 'googleai', model });
      } catch (e) {
        return NextResponse.json({ error: 'Falha ao executar Genkit/Gemini', detail: String(e) }, { status: 500 });
      }
    }

    // Nenhum provedor configurado: retornar 200 com instruções amigáveis
    return NextResponse.json({
      recommendations: 'Para ativar as recomendações de IA, defina uma das opções:\n- OPENAI_API_KEY e (opcional) AI_MODEL=openai/gpt-4o-mini\n- ou GEMINI_API_KEY (ou GOOGLE_API_KEY) e AI_MODEL=googleai/gemini-2.5-flash',
      provider: 'none',
      hint: {
        requiredEnv: ['OPENAI_API_KEY ou GEMINI_API_KEY/GOOGLE_API_KEY', 'AI_MODEL opcional'],
        exampleModels: ['openai/gpt-4o-mini', 'googleai/gemini-2.5-flash']
      }
    }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'falha interna' }, { status: 500 });
  }
}

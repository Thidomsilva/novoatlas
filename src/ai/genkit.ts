import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Seleção de modelo: Genkit só precisa saber de modelos suportados pelos plugins ativos (Google AI).
// Para OpenAI, os flows tratam a chamada diretamente via SDK oficial quando AI_MODEL começa com 'openai/'.
const envModel = process.env.AI_MODEL?.trim();
const hasGemini = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
const defaultModel = envModel?.startsWith('googleai/')
  ? envModel
  : hasGemini
  ? 'googleai/gemini-2.5-flash'
  : 'googleai/gemini-2.5-flash';

export const ai = genkit({
  plugins: [googleAI()],
  model: defaultModel,
});

export type SupportedModel =
  | 'googleai/gemini-2.5-flash'
  | 'googleai/gemini-2.0-flash'
  | 'openai/gpt-4o-mini'
  | 'openai/gpt-4o';

export function setAiModelNextRun(model: SupportedModel) {
  // Utilidade: a seleção efetiva é feita no boot via AI_MODEL.
  process.env.AI_MODEL = model;
}

export function isOpenAISelected(): boolean {
  const m = process.env.AI_MODEL?.trim();
  if (m?.startsWith('openai/')) return true;
  // Sem AI_MODEL, mas com chave OpenAI → default para OpenAI
  if (!m && hasOpenAI) return true;
  return false;
}

export function getOpenAIModelId(): string | null {
  const m = process.env.AI_MODEL?.trim();
  if (m?.startsWith('openai/')) return m.split('/')[1] || null;
  // Default quando sem AI_MODEL mas com chave
  if (!m && hasOpenAI) return 'gpt-4o-mini';
  return null;
}

// Helpers de ambiente
export function hasOpenAIKey(): boolean {
  return hasOpenAI;
}

export function hasGeminiKey(): boolean {
  return hasGemini;
}

export function getSelectedProvider(): 'openai' | 'googleai' | 'auto' {
  if (isOpenAISelected()) return 'openai';
  if (envModel?.startsWith('googleai/')) return 'googleai';
  return 'auto';
}

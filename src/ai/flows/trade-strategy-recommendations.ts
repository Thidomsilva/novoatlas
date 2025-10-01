// src/ai/flows/trade-strategy-recommendations.ts
'use server';

/**
 * @fileOverview Provides trade strategy recommendations based on user trading history.
 *
 * - getTradeStrategyRecommendations - A function that returns trade strategy recommendations.
 * - TradeStrategyRecommendationsInput - The input type for the getTradeStrategyRecommendations function.
 * - TradeStrategyRecommendationsOutput - The return type for the getTradeStrategyRecommendations function.
 */

import { ai, isOpenAISelected, getOpenAIModelId } from '@/ai/genkit';
import {z} from 'genkit';
import OpenAI from 'openai';

const TradeStrategyRecommendationsInputSchema = z.object({
  tradingHistory: z
    .string()
    .describe('A summary of the user\'s trading history, including win/loss ratio, average trade duration, and risk tolerance.'),
});
export type TradeStrategyRecommendationsInput = z.infer<
  typeof TradeStrategyRecommendationsInputSchema
>;

const TradeStrategyRecommendationsOutputSchema = z.object({
  recommendations: z
    .string()
    .describe('AI-generated recommendations on risk management settings such as daily profit target, maximum loss, stake percentage, and AI thresholds based on the trading history.'),
});
export type TradeStrategyRecommendationsOutput = z.infer<
  typeof TradeStrategyRecommendationsOutputSchema
>;

export async function getTradeStrategyRecommendations(
  input: TradeStrategyRecommendationsInput
): Promise<TradeStrategyRecommendationsOutput> {
  if (isOpenAISelected()) {
    const modelId = getOpenAIModelId() ?? 'gpt-4o-mini';
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const system = `You are an AI trading strategy expert. Analyze the user's trading history and provide recommendations on how to configure their risk management settings. Provide specific advice on daily profit target, maximum loss, stake percentage, and AI thresholds. Format your response as a list of actionable recommendations.`;
    const user = `Trading History: ${input.tradingHistory}`;

    const chat = await client.chat.completions.create({
      model: modelId,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
    });

    const text = chat.choices?.[0]?.message?.content ?? 'No recommendations available.';
    return { recommendations: text };
  }
  // Gemini/Genkit path
  return tradeStrategyRecommendationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'tradeStrategyRecommendationsPrompt',
  input: {schema: TradeStrategyRecommendationsInputSchema},
  output: {schema: TradeStrategyRecommendationsOutputSchema},
  prompt: `You are an AI trading strategy expert. Analyze the user's trading history and provide recommendations on how to configure their risk management settings.

Trading History: {{{tradingHistory}}}

Provide specific advice on:
- Daily profit target
- Maximum loss
- Stake percentage
- AI thresholds

Format your response as a list of actionable recommendations.
`,
});

const tradeStrategyRecommendationsFlow = ai.defineFlow(
  {
    name: 'tradeStrategyRecommendationsFlow',
    inputSchema: TradeStrategyRecommendationsInputSchema,
    outputSchema: TradeStrategyRecommendationsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

'use server';

/**
 * @fileOverview Analyzes AI predictions and provides a summary of their historical performance.
 *
 * - analyzeAiPredictions - A function that analyzes AI predictions and provides a summary.
 * - AnalyzeAiPredictionsInput - The input type for the analyzeAiPredictions function.
 * - AnalyzeAiPredictionsOutput - The return type for the analyzeAiPredictions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeAiPredictionsInputSchema = z.object({
  tradeHistory: z
    .string()
    .describe(
      'A string containing the historical trading data, including AI predictions and outcomes.'
    ),
});
export type AnalyzeAiPredictionsInput = z.infer<
  typeof AnalyzeAiPredictionsInputSchema
>;

const AnalyzeAiPredictionsOutputSchema = z.object({
  summary: z
    .string()
    .describe(
      'A summary of the AI predictions, including overall accuracy, trends, and key insights.'
    ),
});
export type AnalyzeAiPredictionsOutput = z.infer<
  typeof AnalyzeAiPredictionsOutputSchema
>;

export async function analyzeAiPredictions(
  input: AnalyzeAiPredictionsInput
): Promise<AnalyzeAiPredictionsOutput> {
  return analyzeAiPredictionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeAiPredictionsPrompt',
  input: {schema: AnalyzeAiPredictionsInputSchema},
  output: {schema: AnalyzeAiPredictionsOutputSchema},
  prompt: `You are an AI trading analysis expert. Analyze the provided trade history, which includes AI predictions and actual trade outcomes. Provide a summary of the AI's prediction accuracy, identify any trends in prediction performance, and offer key insights into how the AI is influencing trading decisions. The trade history is as follows:\n\n{{{tradeHistory}}}`,
});

const analyzeAiPredictionsFlow = ai.defineFlow(
  {
    name: 'analyzeAiPredictionsFlow',
    inputSchema: AnalyzeAiPredictionsInputSchema,
    outputSchema: AnalyzeAiPredictionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

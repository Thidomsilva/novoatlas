'use server';

import type { Trade } from '@/lib/types';

export async function exportToCsv(trades: Trade[]): Promise<string> {
  if (!trades || trades.length === 0) {
    return '';
  }

  const headers = ['ID', 'Timestamp', 'Pair', 'Direction', 'Stake', 'Outcome', 'Profit', 'AI Prediction'];
  
  const rows = trades.map(trade => [
    trade.id,
    new Date(trade.timestamp).toISOString(),
    trade.pair,
    trade.direction,
    trade.stake,
    trade.outcome,
    trade.profit,
    trade.aiPrediction,
  ].join(','));

  const csvContent = [
    headers.join(','),
    ...rows
  ].join('\n');

  return csvContent;
}

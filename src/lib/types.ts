export type Broker = 'IQOption' | 'Quotex' | 'Avalon';

export type Trade = {
  id: string;
  timestamp: Date;
  pair: string;
  direction: 'buy' | 'sell';
  stake: number;
  outcome: 'win' | 'loss' | 'pending';
  profit: number;
  aiPrediction: number;
};

export type RiskSettings = {
  dailyProfitTarget: number;
  maxLoss: number;
  stakePercentage: number;
  aiThreshold: number;
};

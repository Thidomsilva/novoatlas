'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Trade, RiskSettings } from '@/lib/types';
import { mockTrades } from '@/lib/mock-data';
import BrokerOverlay from './broker-overlay';
import LiveTradingPanel from './live-trading-panel';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';

const initialRiskSettings: RiskSettings = {
  dailyProfitTarget: 100,
  maxLoss: 50,
  stakePercentage: 2,
  aiThreshold: 75,
};

const PAIRS = ['EUR/USD', 'GBP/JPY', 'AUD/CAD', 'USD/CHF', 'NZD/USD'];

export default function Dashboard() {
  const [trades, setTrades] = useState<Trade[]>(mockTrades);
  const [riskSettings, setRiskSettings] = useState<RiskSettings>(initialRiskSettings);
  const [isTrading, setIsTrading] = useState(false);
  const [balance, setBalance] = useState(1000);

  const isMobile = useIsMobile();

  const dailyProfit = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return trades
      .filter(t => new Date(t.timestamp) >= today)
      .reduce((sum, trade) => sum + trade.profit, 0);
  }, [trades]);

  const winLoss = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaysTrades = trades.filter(t => new Date(t.timestamp) >= today && t.outcome !== 'pending');
    const wins = todaysTrades.filter(t => t.outcome === 'win').length;
    const losses = todaysTrades.filter(t => t.outcome === 'loss').length;
    return { wins, losses };
  }, [trades]);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;

    if (isTrading) {
      interval = setInterval(() => {
        const stake = balance * (riskSettings.stakePercentage / 100);
        const newTrade: Trade = {
          id: (trades.length + 1).toString(),
          timestamp: new Date(),
          pair: PAIRS[Math.floor(Math.random() * PAIRS.length)],
          direction: Math.random() > 0.5 ? 'buy' : 'sell',
          stake,
          outcome: 'pending',
          profit: 0,
          aiPrediction: Math.random() * (0.99 - 0.5) + 0.5,
        };
        
        setTrades(prev => [newTrade, ...prev]);

        // Simulate trade outcome
        setTimeout(() => {
          setTrades(prevTrades => {
            const currentTrade = prevTrades.find(t => t.id === newTrade.id);
            if (!currentTrade) return prevTrades;
            
            const outcome = Math.random() > 0.45 ? 'win' : 'loss';
            const profit = outcome === 'win' ? stake * 0.87 : -stake;
            
            const updatedTrade = { ...currentTrade, outcome, profit };
            
            setBalance(prevBalance => prevBalance + profit);
            
            return prevTrades.map(t => (t.id === newTrade.id ? updatedTrade : t));
          });
        }, 5000); // 5 second trade

      }, 10000); // New trade every 10 seconds
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isTrading, balance, riskSettings, trades.length]);

  const overlay = (
    <BrokerOverlay
      isTrading={isTrading}
      onToggleTrading={() => setIsTrading(prev => !prev)}
      riskSettings={riskSettings}
      onSettingsChange={setRiskSettings}
      trades={trades}
      isMobile={isMobile}
    />
  );
  
  return (
    <div className="relative min-h-screen w-full bg-background font-body text-foreground">
      <main className="p-4 md:p-8">
        <LiveTradingPanel
          balance={balance}
          dailyProfit={dailyProfit}
          winLoss={winLoss}
          trades={trades}
        />
      </main>
      
      {isMobile ? (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="default" size="icon" className="fixed bottom-6 right-6 z-40 rounded-full h-14 w-14 shadow-lg">
              <Settings className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[90vh] p-0 z-50 rounded-t-lg">
             <SheetHeader className="p-4 border-b">
                <SheetTitle>Atlas Control Panel</SheetTitle>
             </SheetHeader>
            <div className="p-4 h-full overflow-y-auto">
              {overlay}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        overlay
      )}
    </div>
  );
}

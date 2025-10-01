'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Trade, RiskSettings } from '@/lib/types';
import BrokerOverlay from './broker-overlay';
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
  const [trades, setTrades] = useState<Trade[]>([]);
  const [riskSettings, setRiskSettings] = useState<RiskSettings>(initialRiskSettings);
  const [isTrading, setIsTrading] = useState(false);
  const [balance, setBalance] = useState(0);
  const [lastTradeAt, setLastTradeAt] = useState<number | null>(null);

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

  // Atualiza saldo real da Quotex periodicamente quando trading estiver ativo
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    const poll = async () => {
      try {
        const res = await fetch('/api/broker/quotex/status');
        const data = await res.json();
        if (data?.isLoggedIn && typeof data.balance === 'number') {
          setBalance(data.balance);
        }
      } catch {}
    };
    poll();
    if (isTrading) {
      interval = setInterval(poll, 15000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isTrading]);

  // Loop simples de execução quando trading está ativo (cooldown + stop diário)
  useEffect(() => {
    if (!isTrading) return;
    let timer: NodeJS.Timeout | null = null;
    const COOLDOWN_MS = 15_000; // 15s
    const loop = async () => {
      // Stop diário por PnL
      if (dailyProfit <= -Math.abs(riskSettings.maxLoss)) return;
      if (dailyProfit >= Math.abs(riskSettings.dailyProfitTarget)) return;
      // Cooldown
      const now = Date.now();
      if (lastTradeAt && now - lastTradeAt < COOLDOWN_MS) return;
      try {
        const candles = trades.slice(0, 10).map(t => ({ o: t.stake, h: t.stake * 1.01, l: t.stake * 0.99, c: t.stake }));
        const res = await fetch('/api/trade/auto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brain: 'auto', pair: 'EURUSD_otc', tf_sec: 60,
            features: { candles, rsi14: 50, ema9: 1, ema21: 1, ema50: 1, atrz: 1, bbpos: 0, macd_hist: 0 },
            session: { wins_row: winLoss.wins, losses_row: winLoss.losses, pnl_day: dailyProfit, gales_left: 1, payout: 0.87 },
            policy_hints: { th_prob: 0.58, th_score: 0.1, th_policy: Math.max(0, Math.min(1, (riskSettings.aiThreshold ?? 60) / 100)) },
            stake_percentage: riskSettings.stakePercentage,
            min_stake: 1,
          }),
        });
        await res.json().catch(() => ({}));
        setLastTradeAt(Date.now());
      } catch {}
    };
    timer = setInterval(loop, 5000);
    return () => { if (timer) clearInterval(timer); };
  }, [isTrading, trades, riskSettings, dailyProfit, winLoss]);

  const overlay = (
    <BrokerOverlay
      isTrading={isTrading}
      onToggleTrading={() => setIsTrading(prev => !prev)}
      riskSettings={riskSettings}
      onSettingsChange={setRiskSettings}
      trades={trades}
      balance={balance}
      dailyProfit={dailyProfit}
      winLoss={winLoss}
      isMobile={isMobile}
    />
  );
  
  return (
    <div className="relative min-h-screen w-full font-body text-foreground">
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

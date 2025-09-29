'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "./stat-card";
import { TradeHistoryTable } from "./trade-history-table";
import { Wallet, TrendingUp, Ratio, Download, Bot, Loader2 } from "lucide-react";
import type { Trade } from "@/lib/types";
import { AtlasLogo } from "./atlas-logo";
import { exportToCsv } from "@/app/actions";
import { analyzeAiPredictions } from "@/ai/flows/ai-prediction-analysis";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface LiveTradingPanelProps {
  balance: number;
  dailyProfit: number;
  winLoss: { wins: number; losses: number };
  trades: Trade[];
}

export default function LiveTradingPanel({
  balance,
  dailyProfit,
  winLoss,
  trades,
}: LiveTradingPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const { toast } = useToast();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const tradesAsJson = JSON.parse(JSON.stringify(trades));
      const csvData = await exportToCsv(tradesAsJson);
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `atlas-trades-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to export:", error);
      toast({
        variant: 'destructive',
        title: "Export Failed",
        description: "Could not export trade data."
      })
    } finally {
      setIsExporting(false);
    }
  };

  const handleAiAnalysis = async () => {
    setIsLoadingAi(true);
    try {
        const historyString = trades.map(t => 
            `Trade on ${new Date(t.timestamp).toISOString()}: ${t.direction} ${t.pair} with stake ${t.stake}, AI prediction confidence ${t.aiPrediction}, outcome ${t.outcome}, profit ${t.profit}`
        ).join('\n');
        
        const result = await analyzeAiPredictions({ tradeHistory: historyString });
        setAiAnalysis(result.summary);
    } catch (error) {
        console.error("AI analysis failed:", error);
        toast({
            variant: "destructive",
            title: "AI Error",
            description: "Could not fetch AI analysis.",
        });
    } finally {
        setIsLoadingAi(false);
    }
  };

  const winRate = (winLoss.wins + winLoss.losses) > 0 ? (winLoss.wins / (winLoss.wins + winLoss.losses)) * 100 : 0;
  
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl md:text-3xl font-bold font-headline">Trading Dashboard</h1>
          </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Account Balance"
          value={`$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={Wallet}
        />
        <StatCard
          title="Today's P/L"
          value={`${dailyProfit >= 0 ? '+' : ''}$${dailyProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={TrendingUp}
        />
        <StatCard
          title="Today's Win Rate"
          value={`${winRate.toFixed(1)}% (${winLoss.wins}W / ${winLoss.losses}L)`}
          icon={Ratio}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle>Trade History</CardTitle>
            <p className="text-sm text-muted-foreground">
              Recent trades executed by the bot.
            </p>
          </div>
          <div className="flex gap-2">
             <Button variant="outline" size="sm" onClick={handleAiAnalysis} disabled={isLoadingAi}>
                {isLoadingAi ? <Loader2 className="animate-spin" /> : <Bot />}
                <span className="hidden md:inline ml-2">Analyze AI</span>
             </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
              {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
              <span className="hidden md:inline ml-2">Export CSV</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <TradeHistoryTable trades={trades} />
        </CardContent>
      </Card>

      <AlertDialog open={!!aiAnalysis} onOpenChange={() => setAiAnalysis(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>AI Performance Analysis</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-wrap text-left max-h-[60vh] overflow-y-auto">
              {aiAnalysis}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAiAnalysis(null)}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

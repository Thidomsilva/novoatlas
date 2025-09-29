'use client';

import React, { useState, useEffect, useRef } from 'react';
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { getTradeStrategyRecommendations } from '@/ai/flows/trade-strategy-recommendations';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Move, Play, Square, Bot, Loader2, X, CheckCircle, AlertCircle, Wallet, TrendingUp, Ratio } from 'lucide-react';
import type { Broker, RiskSettings, Trade } from '@/lib/types';
import { AtlasLogo } from './atlas-logo';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { StatCard } from './stat-card';
import { TradeHistoryTable } from './trade-history-table';

const formSchema = z.object({
  dailyProfitTarget: z.coerce.number().min(0, "Must be positive"),
  maxLoss: z.coerce.number().min(0, "Must be positive"),
  stakePercentage: z.coerce.number().min(0.1, "Min 0.1%").max(100, "Max 100%"),
  aiThreshold: z.coerce.number().min(0, "Min 0%").max(100, "Max 100%"),
});

interface BrokerOverlayProps {
  isTrading: boolean;
  onToggleTrading: () => void;
  riskSettings: RiskSettings;
  onSettingsChange: (settings: RiskSettings) => void;
  trades: Trade[];
  balance: number;
  dailyProfit: number;
  winLoss: { wins: number; losses: number };
  isMobile: boolean;
}

const BROKERS: Broker[] = ['Quotex', 'Exnova', 'Pocket Option', 'IQOption', 'Deriv'];

export default function BrokerOverlay({
  isTrading,
  onToggleTrading,
  riskSettings,
  onSettingsChange,
  trades,
  balance,
  dailyProfit,
  winLoss,
  isMobile
}: BrokerOverlayProps) {
  const [selectedBroker, setSelectedBroker] = useState<Broker>('Quotex');
  const [connectedBroker, setConnectedBroker] = useState<Broker | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 32, y: 32 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);

  const { toast } = useToast();
  const isDesktop = !isMobile;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: riskSettings,
  });

  useEffect(() => {
    form.reset(riskSettings);
  }, [riskSettings, form]);
  
  function onSubmit(values: z.infer<typeof formSchema>) {
    onSettingsChange(values);
    toast({
        title: "Settings Saved",
        description: "Your new risk management settings have been applied.",
    });
  }

  const handleConnectBroker = () => {
    setIsConnecting(true);
    // Simulate connection
    setTimeout(() => {
        setConnectedBroker(selectedBroker);
        setIsConnecting(false);
        setIsDialogOpen(false);
        toast({
            title: `Connected to ${selectedBroker}`,
            description: "You are now ready to start trading.",
        });
    }, 1500);
  };
  
  const handleDisconnect = () => {
    toast({
      title: `Disconnected from ${connectedBroker}`,
      variant: 'destructive'
    })
    setConnectedBroker(null);
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (overlayRef.current && isDesktop) {
      const rect = overlayRef.current.getBoundingClientRect();
      offsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      setIsDragging(true);
      document.body.style.cursor = 'grabbing';
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !overlayRef.current) return;
      e.preventDefault();
      
      const newX = e.clientX - offsetRef.current.x;
      const newY = e.clientY - offsetRef.current.y;
      
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };
    
    if (isDragging && isDesktop) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'default';
    };
  }, [isDragging, isDesktop]);

  const handleGetAiRecommendation = async () => {
    setIsLoadingAi(true);
    try {
        const winLossRatio = trades.filter(t => t.outcome === 'win').length / (trades.filter(t => t.outcome === 'loss').length || 1);
        const tradingHistorySummary = `User has ${trades.length} trades. Win/loss ratio is approximately ${winLossRatio.toFixed(2)}. Current stake is ${riskSettings.stakePercentage}%.`;
        
        const result = await getTradeStrategyRecommendations({ tradingHistory: tradingHistorySummary });
        setAiRecommendation(result.recommendations);
    } catch (error) {
        console.error("AI recommendation failed:", error);
        toast({
            variant: "destructive",
            title: "AI Error",
            description: "Could not fetch AI recommendations.",
        });
    } finally {
        setIsLoadingAi(false);
    }
  };
  
  const winRate = (winLoss.wins + winLoss.losses) > 0 ? (winLoss.wins / (winLoss.wins + winLoss.losses)) * 100 : 0;

  return (
    <>
      <div
        ref={overlayRef}
        className={cn( "z-30 w-full", isDesktop && "fixed w-[600px]" )}
        style={isDesktop ? { top: position.y, left: position.y, touchAction: 'none' } : {}}
      >
        <Card className={cn(isDesktop && "shadow-2xl bg-card/80 backdrop-blur-sm border-primary/20")}>
          <CardHeader 
            className={cn("flex flex-row items-center justify-between p-4", isDesktop && "cursor-grab active:cursor-grabbing")}
            onMouseDown={handleMouseDown}
          >
            <AtlasLogo />
            {isDesktop && <Move className="h-5 w-5 text-muted-foreground" />}
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Saldo da conta"
                value={`$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={Wallet}
              />
              <StatCard
                title="Lucro atual"
                value={`${dailyProfit >= 0 ? '+' : ''}$${dailyProfit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={TrendingUp}
              />
              <StatCard
                title="W/L"
                value={`${winLoss.wins}W / ${winLoss.losses}L`}
                icon={Ratio}
                smallValue={true}
              />
               <StatCard
                title="Winrate"
                value={`${winRate.toFixed(1)}%`}
                icon={Ratio}
                smallValue={true}
              />
            </div >
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Histórico de Operações</CardTitle>
              </CardHeader>
              <CardContent>
                <TradeHistoryTable trades={trades} />
              </CardContent>
            </Card>

            <div className="p-4 rounded-lg bg-muted/50 border">
                 <div className="flex justify-between items-center">
                    <div>
                        <Label className="text-xs text-muted-foreground">Broker Connection</Label>
                        {connectedBroker ? (
                            <div className="flex items-center gap-2 text-lg font-semibold text-success">
                                <CheckCircle className="h-5 w-5" />
                                <span>{connectedBroker}</span>
                            </div>
                        ) : (
                             <div className="flex items-center gap-2 text-lg font-semibold text-destructive">
                                <AlertCircle className="h-5 w-5" />
                                <span>Not Connected</span>
                            </div>
                        )}
                    </div>
                    {connectedBroker ? (
                         <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={isTrading}>Disconnect</Button>
                    ) : (
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button>Connect</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                <DialogTitle>Connect to Broker</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label>Select Broker</Label>
                                    <RadioGroup
                                        value={selectedBroker}
                                        onValueChange={(value: string) => setSelectedBroker(value as Broker)}
                                        className="grid grid-cols-3 gap-2"
                                    >
                                    {BROKERS.map(b => (
                                        <div key={b} className="flex items-center">
                                        <RadioGroupItem value={b} id={b} className="peer sr-only" />
                                        <Label
                                            htmlFor={b}
                                            className="flex h-12 w-full cursor-pointer items-center justify-center rounded-md border-2 border-muted bg-popover text-xs hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary"
                                        >
                                            {b}
                                        </Label>
                                        </div>
                                    ))}
                                    </RadioGroup>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Login (email)</Label>
                                    <Input id="email" placeholder="email@example.com" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input id="password" type="password" />
                                </div>
                                </div>
                                <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="secondary" disabled={isConnecting}>
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button type="button" onClick={handleConnectBroker} disabled={isConnecting}>
                                    {isConnecting ? <Loader2 className="animate-spin" /> : 'Connect'}
                                </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                 </div>
              </div>

              <Separator />
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <h3 className="text-lg font-semibold font-headline">Risk Management</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="dailyProfitTarget" render={({ field }) => ( <FormItem><FormLabel>Profit Target ($)</FormLabel><FormControl><Input type="number" {...field} disabled={isTrading} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="maxLoss" render={({ field }) => ( <FormItem><FormLabel>Max Loss ($)</FormLabel><FormControl><Input type="number" {...field} disabled={isTrading} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="stakePercentage" render={({ field }) => ( <FormItem><FormLabel>Stake (%)</FormLabel><FormControl><Input type="number" {...field} disabled={isTrading} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="aiThreshold" render={({ field }) => ( <FormItem><FormLabel>AI Threshold (%)</FormLabel><FormControl><Input type="number" {...field} disabled={isTrading} /></FormControl><FormMessage /></FormItem> )} />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button type="button" variant="outline" className="w-full" onClick={handleGetAiRecommendation} disabled={isTrading || isLoadingAi}>
                        {isLoadingAi ? <Loader2 className="animate-spin" /> : <Bot />} Get AI Recs
                    </Button>
                    <Button type="submit" className="w-full" disabled={isTrading}>Save</Button>
                  </div>
                </form>
              </Form>

              <Separator />

              <Button
                size="lg"
                className="w-full font-bold text-lg h-12"
                variant={isTrading ? 'destructive' : 'default'}
                onClick={onToggleTrading}
                disabled={!connectedBroker}
              >
                {isTrading ? <Square className="mr-2" /> : <Play className="mr-2" />}
                {isTrading ? 'Stop Trading' : 'Start Trading'}
              </Button>
          </CardContent>
        </Card>
      </div>

       <AlertDialog open={!!aiRecommendation} onOpenChange={() => setAiRecommendation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>AI Strategy Recommendations</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-wrap text-left max-h-[60vh] overflow-y-auto">
              {aiRecommendation}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAiRecommendation(null)}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 32, y: 32 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);
  const [decisionLog, setDecisionLog] = useState<any | null>(null);
  const [placing, setPlacing] = useState(false);

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

  const handleLocalBrowser = async () => {
    setIsConnecting(true);
    try {
      if (!selectedBroker) {
        toast({ 
          variant: 'destructive', 
          title: 'Broker não selecionado', 
          description: 'Selecione uma corretora primeiro' 
        });
        return;
      }

      const brokerMap: Record<string, string> = {
        'Quotex': 'quotex',
        'IQOption': 'iqoption', 
        'Exnova': 'exnova'
      };

      const brokerKey = brokerMap[selectedBroker];
      if (!brokerKey) {
        toast({ 
          variant: 'destructive', 
          title: 'Broker não suportado', 
          description: `Navegador local não disponível para ${selectedBroker}` 
        });
        return;
      }

      console.log(`🖥️ Abrindo navegador LOCAL para ${selectedBroker}...`);
      const res = await fetch('/api/local-browser', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: loginEmail, 
          password: loginPassword,
          broker: brokerKey 
        })
      });
      
      const data = await res.json();
      
      if (res.ok && data?.success) {
        toast({ 
          title: `🖥️ Navegador ${selectedBroker}`, 
          description: data.message
        });
        console.log(`✅ Navegador local aberto para ${selectedBroker}`);
      } else {
        const errorMsg = data?.message || 'Erro desconhecido no navegador local';
        toast({ 
          variant: 'destructive', 
          title: `❌ Falha no navegador local - ${selectedBroker}`, 
          description: errorMsg 
        });
        console.error(`❌ Erro no navegador local para ${selectedBroker}:`, data);
      }
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Erro de conexão no navegador local' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDebugBroker = async () => {
    setIsConnecting(true);
    try {
      // Determinar a URL da API de debug baseada no broker selecionado
      let debugApiUrl = '';
      if (selectedBroker === 'Quotex') {
        debugApiUrl = '/api/debug/quotex';
      } else if (selectedBroker === 'IQOption') {
        debugApiUrl = '/api/debug/iqoption';
      } else if (selectedBroker === 'Exnova') {
        debugApiUrl = '/api/debug/exnova';
      } else {
        toast({ 
          variant: 'destructive', 
          title: 'Debug não suportado', 
          description: `Debug visual não disponível para ${selectedBroker}` 
        });
        return;
      }

      console.log(`🐛 Iniciando debug visual para ${selectedBroker}...`);
      const res = await fetch(debugApiUrl, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      
      const data = await res.json();
      
      if (res.ok && data?.success) {
        toast({ 
          title: `🐛 Debug ${selectedBroker}`, 
          description: data.message
        });
        console.log(`✅ Debug visual iniciado para ${selectedBroker}`);
      } else {
        const errorMsg = data?.message || 'Erro desconhecido no debug';
        toast({ 
          variant: 'destructive', 
          title: `❌ Falha no debug - ${selectedBroker}`, 
          description: errorMsg 
        });
        console.error(`❌ Erro no debug para ${selectedBroker}:`, data);
      }
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Erro de conexão no debug' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectBroker = async () => {
    setIsConnecting(true);
    try {
      // Determinar a URL da API baseada no broker selecionado
      let apiUrl = '';
      if (selectedBroker === 'Quotex') {
        apiUrl = '/api/broker/quotex/connect';
      } else if (selectedBroker === 'IQOption') {
        apiUrl = '/api/broker/iqoption/connect';
      } else if (selectedBroker === 'Exnova') {
        apiUrl = '/api/broker/exnova/connect';
      } else {
        toast({ 
          variant: 'destructive', 
          title: 'Broker não suportado', 
          description: `Por enquanto apenas Quotex, IQ Option e Exnova são suportadas. Selecionado: ${selectedBroker}` 
        });
        return;
      }

      console.log(`🚀 Conectando ao ${selectedBroker}...`);
      
      toast({ 
        title: `🔄 Conectando ${selectedBroker}`, 
        description: 'Abrindo navegador e fazendo login...' 
      });

      const res = await fetch(apiUrl, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail || undefined, password: loginPassword || undefined })
      });
      
      const data = await res.json();
      
      if (res.ok && data?.isLoggedIn && data?.isReady) {
        setConnectedBroker(selectedBroker);
        setIsDialogOpen(false);
        toast({ 
          title: `✅ ${selectedBroker} Pronto!`, 
          description: `Navegador aberto e pronto para sinais! Saldo: $${(data.balance ?? 0).toFixed(2)}` 
        });
        console.log(`✅ ${selectedBroker} conectado e pronto para operação!`);
      } else {
        const errorMsg = data?.message || 'Erro na conexão';
        toast({ 
          variant: 'destructive', 
          title: `❌ Falha na conexão - ${selectedBroker}`, 
          description: errorMsg 
        });
        console.error(`❌ Erro na conexão com ${selectedBroker}:`, data);
      }
    } catch (e) {
      console.error(e);
  toast({ variant: 'destructive', title: 'Erro de conexão' });
    } finally {
      setIsConnecting(false);
    }
  };
  
  const handleDisconnect = () => {
    toast({
      title: `Desconectado de ${connectedBroker}`,
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
        
  const res = await fetch('/api/ai/recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tradingHistory: tradingHistorySummary }) });
  const result = await res.json();
  if (!res.ok) throw new Error(result?.error || 'Falha');
  const header = result?.provider ? `Origem: ${result.provider}${result?.model ? ` (${result.model})` : ''}\n\n` : '';
  setAiRecommendation(`${header}${result.recommendations}`);
    } catch (error) {
        console.error("AI recommendation failed:", error);
        toast({
            variant: "destructive",
            title: "Erro de IA",
            description: "Não foi possível obter recomendações.",
        });
    } finally {
        setIsLoadingAi(false);
    }
  };

  const handleTestEnsemble = async () => {
    setIsLoadingAi(true);
    try {
      // Monta features baseado no estado atual dos trades e configurações
      const candles = trades.slice(0, 10).map(t => ({ o: t.stake, h: t.stake * 1.01, l: t.stake * 0.99, c: t.stake }));
      const payload = {
        brain: 'auto',
        pair: 'EURUSD_otc',
        tf_sec: 60,
        features: {
          candles,
          rsi14: 50,
          ema9: 1,
          ema21: 1,
          ema50: 1,
          atrz: 1,
          bbpos: 0,
          macd_hist: 0,
        },
        session: {
          wins_row: winLoss.wins,
          losses_row: winLoss.losses,
          pnl_day: dailyProfit,
          gales_left: 1,
          payout: 0.87,
        },
        policy_hints: { th_prob: 0.58, th_score: 0.1, th_policy: Math.max(0, Math.min(1, (riskSettings.aiThreshold ?? 60) / 100)) },
      };

      const res = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setDecisionLog(data);
      toast({ title: 'Ensemble executed', description: 'Policy computed. Check Decision Log.' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Ensemble Error', description: 'See console for details.' });
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleAutoTrade = async () => {
    setPlacing(true);
    try {
      const candles = trades.slice(0, 10).map(t => ({ o: t.stake, h: t.stake * 1.01, l: t.stake * 0.99, c: t.stake }));
      const payload = {
        brain: 'auto',
        pair: 'EURUSD_otc',
        tf_sec: 60,
        features: { candles, rsi14: 50, ema9: 1, ema21: 1, ema50: 1, atrz: 1, bbpos: 0, macd_hist: 0 },
        session: { wins_row: winLoss.wins, losses_row: winLoss.losses, pnl_day: dailyProfit, gales_left: 1, payout: 0.87 },
        policy_hints: { th_prob: 0.58, th_score: 0.1, th_policy: Math.max(0, Math.min(1, (riskSettings.aiThreshold ?? 60) / 100)) },
        stake_percentage: riskSettings.stakePercentage,
        min_stake: 1,
      };
      const res = await fetch('/api/trade/auto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      setDecisionLog(data);
      if (res.ok) {
        toast({ title: data.executed ? 'Order placed' : 'No entry', description: data.executed ? `${data.order?.side} $${data.order?.stake} / ${data.order?.expiration_sec}s` : data.reason || 'Policy decided to skip' });
      } else {
        toast({ variant: 'destructive', title: 'Auto Trade Error', description: data?.error || 'Unknown' });
      }
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Auto Trade Error' });
    } finally {
      setPlacing(false);
    }
  };
  
  const winRate = (winLoss.wins + winLoss.losses) > 0 ? (winLoss.wins / (winLoss.wins + winLoss.losses)) * 100 : 0;

  return (
    <>
      <div
        ref={overlayRef}
        className={cn( "z-30 w-full", isDesktop && "fixed w-[600px]" )}
        style={isDesktop ? { top: `${position.y}px`, left: `${position.x}px`, touchAction: 'none' } : {}}
      >
        <Card className={cn(isDesktop && "shadow-2xl bg-card/80 backdrop-blur-sm border-primary/20")}>
          <CardHeader 
            className={cn("flex flex-row items-center justify-between p-4", isDesktop && "cursor-grab active:cursor-grabbing")}
            onMouseDown={handleMouseDown}
          >
            <div className="flex items-center gap-2 font-headline text-lg font-semibold">
              <AtlasLogo />
            </div>
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
                <CardTitle className="text-base">Histórico de operações</CardTitle>
              </CardHeader>
              <CardContent>
                <TradeHistoryTable trades={trades} />
              </CardContent>
            </Card>

            <div className="p-4 rounded-lg bg-muted/50 border">
                 <div className="flex justify-between items-center">
                    <div>
                        <Label className="text-xs text-muted-foreground">Conexão com a corretora</Label>
                        {connectedBroker ? (
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2 text-lg font-semibold text-success">
                                    <CheckCircle className="h-5 w-5" />
                                    <span>{connectedBroker}</span>
                                </div>
                                <div className="text-xs text-green-600">
                                    🌐 Navegador ativo • 🎯 Pronto para sinais
                                </div>
                            </div>
                        ) : (
                             <div className="flex items-center gap-2 text-lg font-semibold text-destructive">
                                <AlertCircle className="h-5 w-5" />
                                <span>Desconectado</span>
                            </div>
                        )}
                    </div>
                    {connectedBroker ? (
                         <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={isTrading}>Desconectar</Button>
                    ) : (
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button>Connect</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                <DialogTitle>Conectar à corretora</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label>Escolha a corretora</Label>
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
                                    <Label htmlFor="email">Login (e‑mail)</Label>
                                    <Input id="email" placeholder="email@example.com" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Senha</Label>
                                    <Input id="password" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} />
                                </div>
                                </div>
                                <DialogFooter>
                                <DialogClose asChild>
                  <Button type="button" variant="secondary" disabled={isConnecting}>
                    Cancelar
                                    </Button>
                                </DialogClose>
                                <Button type="button" onClick={async () => {
                                  try {
                                    // Determinar URL de health check baseada no broker selecionado
                                    let healthUrl = '';
                                    if (selectedBroker === 'Quotex') {
                                      healthUrl = '/api/broker/quotex/health';
                                    } else if (selectedBroker === 'IQOption') {
                                      healthUrl = '/api/broker/iqoption/health';
                                    } else if (selectedBroker === 'Exnova') {
                                      healthUrl = '/api/broker/exnova/health';
                                    } else {
                                      toast({ 
                                        variant: 'destructive', 
                                        title: 'Broker não suportado', 
                                        description: 'Selecione Quotex, IQ Option ou Exnova' 
                                      });
                                      return;
                                    }

                                    console.log(`🔍 Testando conexão com ${selectedBroker}...`);
                                    const r = await fetch(healthUrl);
                                    const d = await r.json();
                                    
                                    if (r.ok && (d?.ok || d?.isLoggedIn)) {
                                      toast({ 
                                        title: `✅ ${selectedBroker} - Conexão OK`, 
                                        description: `Saldo: ${typeof d.balance === 'number' ? `$${d.balance.toFixed(2)}` : 'indisponível'}` 
                                      });
                                      console.log(`✅ Health check ${selectedBroker} passou:`, d);
                                    } else {
                                      toast({ 
                                        variant: 'destructive', 
                                        title: `❌ ${selectedBroker} - Health falhou`, 
                                        description: d?.error || 'Verifique logs do servidor' 
                                      });
                                      console.error(`❌ Health check ${selectedBroker} falhou:`, d);
                                    }
                                  } catch (e) {
                                    toast({ 
                                      variant: 'destructive', 
                                      title: `❌ Erro ao testar ${selectedBroker}`,
                                      description: 'Falha na comunicação com o servidor'
                                    });
                                    console.error('Erro no health check:', e);
                                  }
                                }} variant="outline">
                                  Testar conexão
                                </Button>
                                
                                {/* Botão de Debug Visual */}
                                <Button type="button" onClick={async () => {
                                  try {
                                    setIsConnecting(true);
                                    toast({ 
                                      title: '🎬 Iniciando Debug Visual',
                                      description: `Abrindo navegador ${selectedBroker} para visualização remota...`
                                    });
                                    
                                    const res = await fetch('/api/debug/visual', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        broker: selectedBroker,
                                        email: loginEmail,
                                        password: loginPassword
                                      }),
                                    });
                                    
                                    const data = await res.json();
                                    
                                    if (data.success) {
                                      toast({ 
                                        title: '🖥️ Navegador Visual Aberto!',
                                        description: `Acesse: ${data.vncUrl}`
                                      });
                                      
                                      // Abrir VNC via proxy HTTPS (contorna SSL)
                                      window.open('/api/vnc', '_blank');
                                    } else {
                                      toast({ 
                                        variant: 'destructive', 
                                        title: '❌ Erro no Debug Visual',
                                        description: data.message 
                                      });
                                    }
                                    
                                  } catch (e) {
                                    toast({ 
                                      variant: 'destructive', 
                                      title: '❌ Erro no Debug',
                                      description: 'Falha ao iniciar modo visual'
                                    });
                                    console.error('Erro debug visual:', e);
                                  } finally {
                                    setIsConnecting(false);
                                  }
                                }} disabled={isConnecting || !loginEmail || !loginPassword} variant="outline" className="w-full border-blue-500 text-blue-600 hover:bg-blue-50">
                                  🎬 Debug Visual (Ver Navegador)
                                </Button>
                                
                                <Button type="button" onClick={handleConnectBroker} disabled={isConnecting} className="w-full">
                                    {isConnecting ? <Loader2 className="animate-spin" /> : 'Conectar e Abrir Trading'}
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
                  <h3 className="text-lg font-semibold font-headline">Gestão de risco</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="dailyProfitTarget" render={({ field }) => ( <FormItem><FormLabel>Meta diária ($)</FormLabel><FormControl><Input type="number" {...field} disabled={isTrading} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="maxLoss" render={({ field }) => ( <FormItem><FormLabel>Perda máxima ($)</FormLabel><FormControl><Input type="number" {...field} disabled={isTrading} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="stakePercentage" render={({ field }) => ( <FormItem><FormLabel>Aporte por entrada (%)</FormLabel><FormControl><Input type="number" {...field} disabled={isTrading} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="aiThreshold" render={({ field }) => ( <FormItem><FormLabel>Confiança mínima da IA (%)</FormLabel><FormControl><Input type="number" {...field} disabled={isTrading} /></FormControl><FormMessage /></FormItem> )} />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button type="button" variant="outline" className="w-full" onClick={handleGetAiRecommendation} disabled={isTrading || isLoadingAi}>
                        {isLoadingAi ? <Loader2 className="animate-spin" /> : <Bot />} Recomendações da IA
                    </Button>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" className="w-full" variant="secondary" onClick={handleTestEnsemble} disabled={isTrading || isLoadingAi}>
                            Testar Ensemble
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Executa os dois cérebros: Gemini gera a predição numérica e o ChatGPT aplica a política (decide entrar/não entrar) sem enviar ordens.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" className="w-full" variant="outline" onClick={handleAutoTrade} disabled={!connectedBroker || placing}>
                            {placing ? <Loader2 className="animate-spin" /> : 'Operar (política)'}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Roda o ensemble (predição + política) e, se a política aprovar a entrada, envia a ordem para a corretora com seu aporte e parâmetros.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button type="submit" className="w-full" disabled={isTrading}>Salvar</Button>
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
                {isTrading ? 'Parar' : 'Começar'}
              </Button>
          </CardContent>
        </Card>
      </div>

       {/* Decision Log */}
       {decisionLog && (
         <div className="fixed bottom-4 left-4 z-20 max-w-md bg-card/90 backdrop-blur border rounded-lg p-3 text-sm shadow-xl">
           <div className="font-semibold mb-1">Registro de decisões</div>
           <pre className="whitespace-pre-wrap max-h-60 overflow-auto text-xs">{JSON.stringify(decisionLog, null, 2)}</pre>
         </div>
       )}

       <AlertDialog open={!!aiRecommendation} onOpenChange={() => setAiRecommendation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recomendações da IA</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-wrap text-left max-h-[60vh] overflow-y-auto">
              {aiRecommendation}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAiRecommendation(null)}>Fechar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
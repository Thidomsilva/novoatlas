'use client';

import React, { useState, useEffect, useRef } from 'react';
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { getTradeStrategyRecommendations } from '@/ai/flows/trade-strategy-recommendations';
import { useToast } from '@/hooks/use-toast';
import { cn } from "@/lib/utils";

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Move, Play, Square, Bot, Loader2 } from 'lucide-react';
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
  isMobile: boolean;
}

export default function BrokerOverlay({
  isTrading,
  onToggleTrading,
  riskSettings,
  onSettingsChange,
  trades,
  isMobile
}: BrokerOverlayProps) {
  const [broker, setBroker] = useState<Broker>('IQOption');
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

  return (
    <>
      <div
        ref={overlayRef}
        className={cn( "z-30 w-full", isDesktop && "fixed w-[400px]" )}
        style={isDesktop ? { top: position.y, left: position.x, touchAction: 'none' } : {}}
      >
        <Card className={cn(isDesktop && "shadow-2xl bg-card/80 backdrop-blur-sm border-primary/20")}>
          <CardHeader 
            className={cn("flex flex-row items-center justify-between p-4", isDesktop && "cursor-grab active:cursor-grabbing")}
            onMouseDown={handleMouseDown}
          >
            <AtlasLogo />
            {isDesktop && <Move className="h-5 w-5 text-muted-foreground" />}
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Broker</Label>
                <RadioGroup
                  value={broker}
                  onValueChange={(value: string) => setBroker(value as Broker)}
                  className="mt-2 grid grid-cols-3 gap-2"
                  disabled={isTrading}
                >
                  {['IQOption', 'Quotex', 'Avalon'].map(b => (
                    <div key={b} className="flex items-center">
                      <RadioGroupItem value={b} id={b} className="peer sr-only" />
                      <Label
                        htmlFor={b}
                        className="flex h-12 w-full cursor-pointer items-center justify-center rounded-md border-2 border-muted bg-popover text-sm hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary"
                      >
                        {b}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
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
              >
                {isTrading ? <Square className="mr-2" /> : <Play className="mr-2" />}
                {isTrading ? 'Stop Trading' : 'Start Trading'}
              </Button>

            </div>
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

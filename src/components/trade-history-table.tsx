import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Trade } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TradeHistoryTableProps {
  trades: Trade[];
}

export function TradeHistoryTable({ trades }: TradeHistoryTableProps) {
  return (
    <ScrollArea className="h-[200px] w-full rounded-md border">
        <Table>
        <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur-sm">
            <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Pair</TableHead>
            <TableHead>Direction</TableHead>
            <TableHead>Stake</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead className="text-right">Profit</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
            {trades.map((trade) => (
            <TableRow key={trade.id}>
                <TableCell>{new Date(trade.timestamp).toLocaleTimeString()}</TableCell>
                <TableCell className="font-medium">{trade.pair}</TableCell>
                <TableCell>
                    <span className={cn(
                        "font-semibold",
                        trade.direction === 'buy' ? 'text-success' : 'text-destructive'
                    )}>
                        {trade.direction.toUpperCase()}
                    </span>
                </TableCell>
                <TableCell>${trade.stake.toFixed(2)}</TableCell>
                <TableCell>
                <Badge
                    variant={
                        trade.outcome === 'loss' ? 'destructive' : trade.outcome === 'pending' ? 'secondary' : 'default'
                    }
                    className={cn(
                        trade.outcome === 'win' && 'bg-success hover:bg-success/90 text-success-foreground border-transparent', 
                        trade.outcome === 'pending' && 'animate-pulse'
                    )}
                >
                    {trade.outcome}
                </Badge>
                </TableCell>
                <TableCell className={cn(
                    "text-right font-mono",
                    trade.profit > 0 ? "text-success" : trade.profit < 0 ? "text-destructive" : "text-muted-foreground"
                )}>
                {trade.profit > 0 ? '+' : ''}${trade.profit.toFixed(2)}
                </TableCell>
            </TableRow>
            ))}
        </TableBody>
        </Table>
    </ScrollArea>
  );
}

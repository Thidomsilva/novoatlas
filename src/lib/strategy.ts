import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), '.data', 'strategies');

export type ActiveStrategyMeta = { file: string; name?: string; ts?: string };

export async function getActiveStrategy(): Promise<{ meta: ActiveStrategyMeta; strategy: any } | null> {
  try {
    const metaPath = path.join(DATA_DIR, 'active.json');
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8')) as ActiveStrategyMeta;
    const raw = await fs.readFile(meta.file, 'utf-8');
    const strategy = JSON.parse(raw);
    return { meta, strategy };
  } catch {
    return null;
  }
}

export function mergePolicyHints(base: any, override: any) {
  return { ...(base || {}), ...(override || {}) };
}

export function pickStakePercentage(strategy: any): number | undefined {
  const s = strategy || {};
  const pct = s?.risk?.stake_percentage ?? s?.risk?.stakePercent ?? s?.risk?.stakePct;
  return typeof pct === 'number' ? pct : undefined;
}

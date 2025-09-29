import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(process.cwd(), '.data', 'strategies');

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    await fs.mkdir(DATA_DIR, { recursive: true });
    const name = (json?.name || 'estrategia') as string;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(DATA_DIR, `${name}-${ts}.json`);
    await fs.writeFile(file, JSON.stringify(json, null, 2), 'utf-8');
    await fs.writeFile(path.join(DATA_DIR, 'active.json'), JSON.stringify({ file, name, ts }, null, 2), 'utf-8');
    return NextResponse.json({ ok: true, saved: file, active: { file, name, ts } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'upload-failed' }, { status: 400 });
  }
}

export async function GET() {
  try {
    const metaPath = path.join(DATA_DIR, 'active.json');
    const meta = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
    const content = await fs.readFile(meta.file, 'utf-8');
    return NextResponse.json({ ok: true, active: meta, strategy: JSON.parse(content) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'no-active' }, { status: 404 });
  }
}

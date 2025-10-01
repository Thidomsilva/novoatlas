import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  console.log('🧪 [TEST] Endpoint de teste chamado!');
  
  return NextResponse.json({ 
    status: 'working',
    timestamp: new Date().toISOString(),
    message: 'Endpoint funcionando!'
  });
}

export async function POST(req: NextRequest) {
  console.log('🧪 [TEST POST] Endpoint de teste POST chamado!');
  
  try {
    const body = await req.json().catch(() => ({}));
    console.log('🧪 [TEST POST] Body recebido:', body);
    
    return NextResponse.json({ 
      status: 'working',
      received: body,
      timestamp: new Date().toISOString(),
      message: 'POST funcionando!'
    });
  } catch (e) {
    console.error('🧪 [TEST POST] Erro:', e);
    return NextResponse.json({ error: 'Erro no POST' }, { status: 500 });
  }
}
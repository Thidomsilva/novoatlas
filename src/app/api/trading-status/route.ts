import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Em um sistema real, você manteria uma lista de instâncias ativas
    // Por agora, retornamos um status mockado
    
    const status = {
      isConnected: true, // Se há alguma instância ativa
      browser: 'Quotex', // Broker atual
      status: 'ready', // connecting, login_failed, ready, etc.
      lastUpdate: new Date().toISOString(),
      screenshot: '', // Base64 do último screenshot
      message: 'Sistema pronto para receber sinais'
    };

    return NextResponse.json(status);
    
  } catch (error) {
    console.error('❌ [Trading Status] Erro:', error);
    return NextResponse.json({ 
      isConnected: false,
      browser: null,
      status: 'error',
      lastUpdate: new Date().toISOString(),
      screenshot: '',
      message: 'Erro ao verificar status'
    }, { status: 500 });
  }
}
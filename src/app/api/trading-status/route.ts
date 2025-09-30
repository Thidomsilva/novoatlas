import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // STATUS REAL - Verificar se há instâncias ativas dos brokers
    
    // Verificar Quotex
    const quotexStatus = await fetch('/api/broker/quotex/status').catch(() => ({ json: () => ({ isLoggedIn: false }) }));
    const quotexData = await quotexStatus.json();
    
    // Verificar IQ Option  
    const iqStatus = await fetch('/api/broker/iqoption/status').catch(() => ({ json: () => ({ isLoggedIn: false }) }));
    const iqData = await iqStatus.json();
    
    // Verificar Exnova
    const exnovaStatus = await fetch('/api/broker/exnova/status').catch(() => ({ json: () => ({ isLoggedIn: false }) }));
    const exnovaData = await exnovaStatus.json();
    
    // Determinar status real
    const isConnected = quotexData.isLoggedIn || iqData.isLoggedIn || exnovaData.isLoggedIn;
    const activeBroker = quotexData.isLoggedIn ? 'Quotex' : iqData.isLoggedIn ? 'IQOption' : exnovaData.isLoggedIn ? 'Exnova' : 'None';
    
    const status = {
      isConnected,
      browser: activeBroker,
      status: isConnected ? 'ready' : 'disconnected',
      lastUpdate: new Date().toISOString(),
      screenshot: '',
      message: isConnected ? `${activeBroker} conectado e pronto` : 'Nenhum broker conectado'
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
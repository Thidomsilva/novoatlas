import { NextResponse } from 'next/server';

export async function GET() {
  const instructionsPage = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>VNC Debug - NovoAtlas</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
          background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
          color: white; 
          padding: 20px; 
          line-height: 1.6;
          min-height: 100vh;
        }
        .container { max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; }
        .btn { 
          background: linear-gradient(135deg, #0066cc, #0052a3);
          color: white; 
          padding: 18px 36px; 
          border: none; 
          border-radius: 12px; 
          text-decoration: none; 
          display: inline-block; 
          margin: 10px; 
          font-size: 18px;
          font-weight: bold;
          box-shadow: 0 4px 15px rgba(0,102,204,0.3);
          transition: all 0.3s ease;
          cursor: pointer;
        }
        .btn:hover { 
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0,102,204,0.5);
        }
        .btn-primary {
          font-size: 24px;
          padding: 25px 50px;
          background: linear-gradient(135deg, #ff6600, #e55100);
          box-shadow: 0 4px 20px rgba(255,102,0,0.4);
        }
        .btn-primary:hover {
          box-shadow: 0 8px 30px rgba(255,102,0,0.6);
        }
        .warning { 
          background: linear-gradient(135deg, #ff6600, #e55100);
          padding: 25px; 
          border-radius: 12px; 
          margin: 30px 0; 
          font-weight: bold;
          border-left: 5px solid #ff8800;
        }
        .url-box {
          background: #2a2a2a;
          padding: 25px;
          border-radius: 12px;
          font-family: 'Courier New', 'Menlo', monospace;
          font-size: 18px;
          margin: 25px 0;
          word-break: break-all;
          border: 3px solid #0066cc;
          position: relative;
          cursor: pointer;
        }
        .url-box:hover {
          border-color: #ff6600;
          background: #333;
        }
        .step {
          background: rgba(255,255,255,0.05);
          padding: 25px;
          margin: 20px 0;
          border-radius: 12px;
          border-left: 5px solid #0066cc;
        }
        .status {
          background: linear-gradient(135deg, #00aa00, #008800);
          padding: 25px;
          border-radius: 12px;
          margin: 30px 0;
          text-align: center;
          font-size: 20px;
          font-weight: bold;
        }
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin: 30px 0;
        }
        .feature-card {
          background: rgba(255,255,255,0.08);
          padding: 25px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .copy-btn {
          position: absolute;
          top: 10px;
          right: 10px;
          background: #0066cc;
          border: none;
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
        }
        @media (max-width: 600px) {
          .btn { padding: 15px 25px; font-size: 16px; }
          .btn-primary { padding: 20px 30px; font-size: 20px; }
          body { padding: 15px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🖥️ VNC Debug - NovoAtlas</h1>
          <p><strong>Visualização Remota do Navegador Servidor</strong></p>
        </div>
        
        <div class="status">
          ✅ <strong>VNC Server Online & Funcionando!</strong><br>
          <small>Pronto para debug visual em tempo real</small>
        </div>
        
        <div style="text-align: center; margin: 40px 0;">
          <a href="http://novoatlas.fly.dev:6080/vnc.html" class="btn btn-primary" target="_blank">
            🚀 ABRIR VNC AGORA
          </a>
        </div>
        
        <div class="warning">
          ⚠️ <strong>IMPORTANTE:</strong> O VNC funciona apenas via HTTP (sem HTTPS).<br>
          Seu navegador mostrará avisos de segurança - <strong>isso é totalmente NORMAL!</strong><br>
          <strong>Continue clicando em "Avançado" → "Prosseguir"</strong>
        </div>
        
        <div class="step">
          <h3>🔗 URL para copiar:</h3>
          <div class="url-box" onclick="copyToClipboard()" title="Clique para copiar">
            <button class="copy-btn" onclick="copyToClipboard()">Copiar</button>
            http://novoatlas.fly.dev:6080/vnc.html
          </div>
          <small>👆 Clique na caixa para copiar automaticamente</small>
        </div>
        
        <div class="feature-grid">
          <div class="feature-card">
            <h3>🛡️ Avisos de Segurança</h3>
            <ul>
              <li><strong>Chrome:</strong> "Avançado" → "Ir para novoatlas.fly.dev"</li>
              <li><strong>Edge:</strong> "Detalhes" → "Continuar para o site"</li>
              <li><strong>Firefox:</strong> "Avançado" → "Aceitar o risco"</li>
            </ul>
          </div>
          
          <div class="feature-card">
            <h3>🎬 Como Usar o Debug</h3>
            <ol>
              <li>Abra o VNC primeiro</li>
              <li>Volte ao NovoAtlas</li>
              <li>Clique "🎬 Debug Visual"</li>
              <li>Assista a automação AO VIVO!</li>
            </ol>
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="http://novoatlas.fly.dev:6080/" class="btn" target="_blank">
            🔧 VNC Interface Alternativa
          </a>
          
          <a href="https://novoatlas.fly.dev" class="btn" target="_blank">
            ← Voltar ao NovoAtlas
          </a>
        </div>
        
        <div class="warning" style="background: linear-gradient(135deg, #0066cc, #0052a3);">
          🎯 <strong>O que você verá no VNC:</strong><br>
          • Desktop remoto (fundo cinza/preto)<br>
          • Interface noVNC com botão "Connect"<br>
          • Navegador Playwright abrindo automaticamente<br>
          • Login da corretora acontecendo em tempo real<br>
          • Cada clique e digitação sendo executado ao vivo!
        </div>
        
        <p style="text-align: center; margin-top: 50px; font-size: 14px; color: #888; border-top: 1px solid #444; padding-top: 20px;">
          ✅ Servidor Ativo | ✅ VNC Porta 6080 Online | ⚠️ Protocolo HTTP (Sem SSL)
        </p>
      </div>
      
      <script>
        function copyToClipboard() {
          const text = 'http://novoatlas.fly.dev:6080/vnc.html';
          navigator.clipboard.writeText(text).then(() => {
            const btn = document.querySelector('.copy-btn');
            const originalText = btn.textContent;
            btn.textContent = '✓ Copiado!';
            btn.style.background = '#00aa00';
            setTimeout(() => {
              btn.textContent = originalText;
              btn.style.background = '#0066cc';
            }, 2000);
          }).catch(() => {
            // Fallback para navegadores antigos
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert('URL copiada para a área de transferência!');
          });
        }
      </script>
    </body>
    </html>
  `;
  
  return new NextResponse(instructionsPage, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
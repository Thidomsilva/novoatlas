'use client';

import { useEffect } from 'react';

export default function VNCPage() {
  useEffect(() => {
    // Redirecionar para o VNC via HTTP (sem SSL)
    window.location.href = 'http://novoatlas.fly.dev:6080/vnc.html';
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center text-white">
        <h1 className="text-2xl font-bold mb-4">🖥️ Redirecionando para VNC...</h1>
        <p className="mb-4">Se não redirecionou automaticamente, acesse:</p>
        <a 
          href="http://novoatlas.fly.dev:6080/vnc.html"
          className="text-blue-400 hover:text-blue-300 underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          http://novoatlas.fly.dev:6080/vnc.html
        </a>
        <p className="mt-4 text-sm text-gray-400">
          ⚠️ Importante: O VNC funciona apenas via HTTP (não HTTPS)
        </p>
      </div>
    </div>
  );
}
# Atlas (trading dashboard + AI tools)

Este projeto é um dashboard de trading com um overlay de controle ("a ferramenta") e integrações de IA via Genkit (flows/Prompts) para recomendações de estratégia e análise de previsões.

## Como ver a ferramenta

1) Instale as dependências
2) Rode o Next.js
3) Abra no navegador

Comandos:

```bash
npm install
npm run dev
```

Por padrão o Next inicia em http://localhost:9002. A página principal carrega o componente `Dashboard` que inclui o overlay `BrokerOverlay`. Em desktop, o overlay é arrastável; em mobile, ele abre como um painel (Sheet) ao tocar no botão com ícone de engrenagem.

Arquivos principais da UI:
- `src/app/page.tsx` – página inicial
- `src/components/dashboard.tsx` – estado de trading mock e painel
- `src/components/broker-overlay.tsx` – a ferramenta (overlay de broker/risco + botão "Get AI Recs")

## Flows de IA (Genkit)

Os flows estão em `src/ai/flows` e são registrados em `src/ai/dev.ts`.

- `trade-strategy-recommendations.ts` – gera recomendações de risco com base em um resumo do histórico
- `ai-prediction-analysis.ts` – sumariza performance histórica de previsões de IA

Suportamos Gemini e OpenAI. Você pode escolher o provedor/modelo via variáveis de ambiente.

Variáveis suportadas:
- `AI_MODEL` (opcional): escolha explícita do modelo, ex: `googleai/gemini-2.5-flash` ou `openai/gpt-4o-mini`.
- `GEMINI_API_KEY` ou `GOOGLE_API_KEY`: chave para Google AI (Gemini).
- `OPENAI_API_KEY`: chave para OpenAI (ChatGPT).

Exemplo de `.env` (veja `.env.example`):

```
# Escolha explícita (opcional)
AI_MODEL=openai/gpt-4o-mini

# Preencha pelo menos uma família de provedores
OPENAI_API_KEY=sk-...
# ou
# GEMINI_API_KEY=...
# GOOGLE_API_KEY=...
```

Como funciona a seleção:
- Se `AI_MODEL` começar com `googleai/`, os flows usam Genkit + plugin Google AI.
- Se `AI_MODEL` começar com `openai/`, os flows chamam o SDK oficial `openai` diretamente.

Para subir o servidor de dev do Genkit (necessário para executar os flows localmente quando usar Gemini):

1) Crie `.env` na raiz com as chaves necessárias (OpenAI e/ou Gemini).

2) Inicie o Genkit Dev Server:

```bash
npm run genkit:dev
```

Isto carrega `src/ai/dev.ts`, que registra os flows. A UI do dashboard consome o flow de recomendações diretamente via import (server action) – então a variável de ambiente também precisa estar disponível no ambiente onde o Next roda quando esse flow é chamado.

Se preferir, você pode apenas usar o botão "Get AI Recs" no overlay – ele chama `getTradeStrategyRecommendations`.

## Scripts

- `npm run dev` – Next.js em modo dev (porta 9002)
- `npm run genkit:dev` – Genkit dev server
- `npm run genkit:watch` – Genkit dev server com watch
- `npm run build` – build de produção do Next

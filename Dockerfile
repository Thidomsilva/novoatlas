# Use a imagem oficial do Node.js com Playwright
FROM mcr.microsoft.com/playwright:v1.48.0-focal

# Instalar VNC e ferramentas de visualização
RUN apt-get update && apt-get install -y \
    x11vnc \
    xvfb \
    fluxbox \
    novnc \
    websockify \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de configuração primeiro
COPY package*.json ./
COPY tsconfig.json ./
COPY next.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.mjs ./

# Instalar TODAS as dependências (incluindo devDependencies para build)
RUN npm ci && \
    npx playwright install chromium && \
    npx playwright install-deps chromium

# Copiar código da aplicação
COPY . .

# Configurar variáveis de ambiente ANTES do build
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_HEADLESS=1
ENV PLAYWRIGHT_CHANNEL=chromium

# Build da aplicação Next.js
RUN npm run build

# Limpar devDependencies após o build
RUN npm prune --production

# Copiar configuração do supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expor portas (Next.js + noVNC)
EXPOSE 3000 6080

# Configurar variáveis de ambiente para X11
ENV DISPLAY=:99

# Comando para iniciar todos os serviços via supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
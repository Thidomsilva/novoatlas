#!/bin/bash

# Iniciar servidor VNC para visualização remota
export DISPLAY=:99
export VNC_PORT=5900
export NOVNC_PORT=6080

# Instalar VNC se necessário
apt-get update
apt-get install -y x11vnc xvfb fluxbox novnc websockify

# Iniciar display virtual
Xvfb :99 -screen 0 1920x1080x24 &

# Iniciar window manager
DISPLAY=:99 fluxbox &

# Iniciar servidor VNC
x11vnc -display :99 -nopw -listen 0.0.0.0 -xkb -ncache 10 -ncache_cr -forever &

# Iniciar noVNC para acesso web
websockify --web=/usr/share/novnc/ 6080 localhost:5900 &

echo "VNC Server rodando na porta 5900"
echo "noVNC Web Interface disponível na porta 6080"
echo "Acesse: http://localhost:6080/vnc.html"
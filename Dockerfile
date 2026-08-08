# Production Dockerfile for Campus SOS by Team Mind Matrixx
# Pre-installs Chromium dependencies for Puppeteer / whatsapp-web.js

FROM node:18-slim

# Install Chromium and required fonts/libraries
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Environment Variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy package files
COPY backend/package*.json ./backend/

# Install dependencies
RUN cd backend && npm install --production

# Copy application source
COPY backend ./backend
COPY frontend ./frontend

# Expose server port
EXPOSE 3001

# Start production server
CMD ["node", "backend/server.js"]

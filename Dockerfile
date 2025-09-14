# ---------- 1) Builder: runs webpack + Puppeteer to produce dist/ ----------
FROM node:18-bullseye-slim AS builder

ENV NODE_OPTIONS=--openssl-legacy-provider

# System Chromium + image tools used during build
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgtk-3-0 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    python3 make g++ \
    libpng-dev libjpeg62-turbo-dev gifsicle optipng pngquant ca-certificates libpng16-16 \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Puppeteer: use system Chromium, don’t download one
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# If your repo includes the puppeteer.launch patch I provided earlier, you're good.
# (It launches with --no-sandbox/--disable-dev-shm-usage and respects EXECUTABLE_PATH.)

COPY . .
RUN npm run build

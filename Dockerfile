# ---------- Base: shared dependencies and setup ----------
FROM node:18-bullseye-slim AS base

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

# Puppeteer: use system Chromium, don't download one
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# ---------- Dev: development environment with hot-reloading ----------
FROM base AS dev

EXPOSE 8080
CMD ["npm", "run", "dev"]

# ---------- Builder: runs webpack + Puppeteer to produce dist/ ----------
FROM base AS builder

# If your repo includes the puppeteer.launch patch I provided earlier, you're good.
# (It launches with --no-sandbox/--disable-dev-shm-usage and respects EXECUTABLE_PATH.)

RUN npm run build

# ---------- Runtime: Caddy serving the built dist/ ----------
FROM caddy:alpine AS runtime

# Copy only the built assets
COPY --from=builder /app/dist /usr/share/caddy

EXPOSE 80

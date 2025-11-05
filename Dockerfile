# Etapa 1: build
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++ git netcat-openbsd

COPY package*.json ./
COPY tsconfig*.json ./

RUN npm ci

COPY . .

RUN npx nest build

# ✅ Compilar desde la ubicación correcta
RUN npx tsc scripts/bootstrapAdmin.ts --outDir dist/scripts --module commonjs --esModuleInterop

# ✅ VERIFICAR compilación
RUN echo "=== Verificando bootstrap compilado ==="
RUN ls -la dist/scripts/

COPY scripts/start.sh ./scripts/
RUN chmod +x ./scripts/start.sh

# Etapa 2: producción
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache python3 make g++ netcat-openbsd

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts
COPY package*.json ./

RUN npm ci --omit=dev

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001
USER nestjs

EXPOSE 3010

CMD ["./scripts/start.sh"]
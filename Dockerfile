# Etapa 1: build
FROM node:20-alpine AS builder
WORKDIR /app

# ✅ Instalar dependencias del sistema + netcat para verificar BD
RUN apk add --no-cache python3 make g++ git

COPY package*.json ./
COPY tsconfig*.json ./

RUN npm ci

COPY . .

RUN npx nest build
# ✅ Compilar el script de bootstrap
RUN npx tsc src/scripts/bootstrapAdmin.ts --outDir dist/scripts --module commonjs

# ✅ Copiar script de inicio
COPY scripts/start.sh ./scripts/
RUN chmod +x ./scripts/start.sh

# Etapa 2: producción
FROM node:20-alpine
WORKDIR /app

# ✅ Instalar dependencias + netcat para verificar BD
RUN apk add --no-cache python3 make g++ netcat-openbsd

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts
COPY package*.json ./

RUN npm ci --omit=dev

# ✅ Usar usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001
USER nestjs

EXPOSE 3010

# ✅ Usar script de inicio
CMD ["./scripts/start.sh"]
# Etapa 1: build
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++ git netcat-openbsd

COPY package*.json ./
COPY tsconfig*.json ./

RUN npm ci

COPY . .

RUN npx nest build

# ✅ Hacer el script ejecutable ANTES de cambiar de usuario
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

# ✅ Crear usuario y grupo PRIMERO
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# ✅ Cambiar permisos del script ANTES de cambiar usuario
RUN chmod +x ./scripts/start.sh

# ✅ Cambiar propietario de los archivos
RUN chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3010

CMD ["./scripts/start.sh"]
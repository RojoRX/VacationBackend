# ===========================
# Etapa 1: Build
# ===========================
FROM node:20-alpine AS builder
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copiar todo el código y compilar NestJS
COPY . .
RUN npx nest build

# ===========================
# Etapa 2: Producción
# ===========================
FROM node:20-alpine
WORKDIR /app

# ⚠️ Configurar zona horaria de Bolivia
RUN apk add --no-cache tzdata \
    && cp /usr/share/zoneinfo/America/La_Paz /etc/localtime \
    && echo "America/La_Paz" > /etc/timezone \
    && apk del tzdata

# Copiar la app y los módulos ya instalados
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Puerto expuesto
EXPOSE 3010

# Ejecutar la app como usuario no root (opcional para seguridad)
RUN addgroup -S nestjs && adduser -S nestjs -G nestjs
USER nestjs

# Comando para iniciar la app
CMD ["node", "dist/main.js"]

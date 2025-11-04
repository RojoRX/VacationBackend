# Etapa 1: build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package.json y lock
COPY package*.json ./
COPY tsconfig*.json ./

# Instalar dependencias (incluyendo dev para build)
RUN npm ci

# Copiar todo el proyecto
COPY . .

# Compilar TS
RUN npx nest build

# Etapa 2: producción
FROM node:20-alpine

WORKDIR /app

# Instalar solo lo necesario para producción
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Copiar archivos necesarios
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --chown=nestjs:nodejs package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --omit=dev --ignore-scripts

# Cambiar a usuario no-root por seguridad
USER nestjs

EXPOSE 3010

# Health check (opcional)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3010/health || exit 1

CMD ["node", "dist/main.js"]
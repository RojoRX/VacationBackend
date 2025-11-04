# Etapa 1: build
FROM node:20-alpine AS builder
WORKDIR /app

# ✅ Instalar dependencias del sistema para módulos nativos
RUN apk add --no-cache python3 make g++ git

COPY package*.json ./
COPY tsconfig*.json ./

RUN npm ci

COPY . .

RUN npx nest build

# Etapa 2: producción
FROM node:20-alpine
WORKDIR /app

# ✅ Instalar dependencias del sistema en producción también
RUN apk add --no-cache python3 make g++

COPY --from=builder /app/dist ./dist
COPY package*.json ./

RUN npm ci --omit=dev

# ✅ Usar usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001
USER nestjs

EXPOSE 3010
CMD ["node", "dist/main.js"]
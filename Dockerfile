# Etapa 1: build
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++ git

COPY package*.json ./
COPY tsconfig*.json ./

RUN npm ci

COPY . .

# ✅ SOLO nest build - ya compila TODO incluido src/scripts/
RUN npx nest build

# ❌ ELIMINAR esta línea - causa errores de rutas
# RUN npx tsc src/scripts/bootstrapAdmin.ts --outDir dist/scripts --module commonjs --experimentalDecorators --emitDecoratorMetadata

# Etapa 2: producción
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY package*.json ./

RUN npm ci --omit=dev

EXPOSE 3010

# ✅ Comando directo sin script por ahora
CMD ["node", "dist/main.js"]
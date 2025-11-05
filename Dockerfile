# Etapa 1: build
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++ git netcat-openbsd

COPY package*.json ./
COPY tsconfig*.json ./

RUN npm ci

COPY . .

RUN npx nest build

# ✅ Compilar el script de bootstrap
RUN npx tsc src/scripts/bootstrapAdmin.ts --outDir dist/scripts --module commonjs --experimentalDecorators --emitDecoratorMetadata

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

EXPOSE 3010

# ✅ Usar shell para mejor logging
CMD ["sh", "-c", "./scripts/start.sh"]
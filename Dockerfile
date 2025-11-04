# Etapa 1: build
FROM node:20-alpine AS builder
WORKDIR /app

# Copiar package.json y lock
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar todo el proyecto
COPY . .

# Compilar TS usando tsconfig.build.json
RUN npx nest build

# Etapa 2: producción
FROM node:20-alpine
WORKDIR /app

# Copiar dist y package.json
COPY --from=builder /app/dist ./dist
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm install --omit=dev

EXPOSE 3001
CMD ["node", "dist/main.js"]

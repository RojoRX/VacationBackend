# VacationBackend/scripts/start.sh
cat > VacationBackend/scripts/start.sh << 'EOF'
#!/bin/sh
set -e

echo "=== INICIO DEL SCRIPT ==="
echo "Directorio actual: $(pwd)"
echo "Contenido de dist/:"
ls -la dist/ | head -10

echo "🔧 Esperando a que PostgreSQL esté listo..."
timeout=30
while ! nc -z postgres 5432; do
  sleep 1
  timeout=$((timeout-1))
  if [ $timeout -eq 0 ]; then
    echo "❌ Timeout esperando PostgreSQL"
    exit 1
  fi
done

echo "✅ PostgreSQL está listo!"

echo "🔧 Ejecutando bootstrap del admin..."
if node dist/scripts/bootstrapAdmin.js; then
  echo "✅ Bootstrap ejecutado"
else
  echo "⚠️ Bootstrap falló o admin ya existe"
fi

echo "🚀 INICIANDO APLICACIÓN NESTJS..."
echo "Ejecutando: node dist/main.js"

# ✅ ESTA ES LA LÍNEA CRÍTICA - debe ser 'exec' para reemplazar el proceso
exec node dist/main.js
EOF

# Hacer ejecutable
chmod +x VacationBackend/scripts/start.sh# VacationBackend/scripts/start.sh
cat > VacationBackend/scripts/start.sh << 'EOF'
#!/bin/sh
set -e

echo "=== INICIO DEL SCRIPT ==="
echo "Directorio actual: $(pwd)"
echo "Contenido de dist/:"
ls -la dist/ | head -10

echo "🔧 Esperando a que PostgreSQL esté listo..."
timeout=30
while ! nc -z postgres 5432; do
  sleep 1
  timeout=$((timeout-1))
  if [ $timeout -eq 0 ]; then
    echo "❌ Timeout esperando PostgreSQL"
    exit 1
  fi
done

echo "✅ PostgreSQL está listo!"

echo "🔧 Ejecutando bootstrap del admin..."
if node dist/scripts/bootstrapAdmin.js; then
  echo "✅ Bootstrap ejecutado"
else
  echo "⚠️ Bootstrap falló o admin ya existe"
fi

echo "🚀 INICIANDO APLICACIÓN NESTJS..."
echo "Ejecutando: node dist/main.js"

# ✅ ESTA ES LA LÍNEA CRÍTICA - debe ser 'exec' para reemplazar el proceso
exec node dist/main.js
EOF

# Hacer ejecutable
chmod +x VacationBackend/scripts/start.sh
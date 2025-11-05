# En VacationBackend/scripts/start.sh
mkdir -p scripts
cat > scripts/start.sh << 'EOF'
#!/bin/sh
set -e

echo "🔧 Esperando a que PostgreSQL esté listo..."
while ! nc -z postgres 5432; do
  sleep 1
done

echo "✅ PostgreSQL está listo!"

echo "🔧 Ejecutando bootstrap del admin..."
node dist/scripts/bootstrapAdmin.js

echo "🚀 Iniciando la aplicación..."
exec node dist/main.js
EOF

chmod +x scripts/start.sh
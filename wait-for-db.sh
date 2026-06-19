#!/bin/sh
# ============================================================
#  wait-for-db.sh
#  Espera a que PostgreSQL esté disponible antes de iniciar Flask.
# ============================================================

HOST="$1"
PORT="$2"
shift 2
CMD="$@"

echo "[wait-for-db] Esperando a que PostgreSQL esté listo en $HOST:$PORT ..."

MAX_RETRIES=30
RETRIES=0

until nc -z "$HOST" "$PORT" 2>/dev/null; do
  RETRIES=$((RETRIES + 1))
  if [ $RETRIES -ge $MAX_RETRIES ]; then
    echo "[wait-for-db] ERROR: PostgreSQL no respondió después de $MAX_RETRIES intentos. Abortando."
    exit 1
  fi
  echo "[wait-for-db] Intento $RETRIES/$MAX_RETRIES — reintentando en 2 segundos..."
  sleep 2
done

echo "[wait-for-db] ✅ PostgreSQL disponible. Iniciando aplicación..."
exec $CMD

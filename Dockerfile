# ============================================================
#  Dockerfile — GOV-PORTAL Backend (Flask)
#  ADVERTENCIA: Imagen de desarrollo, NO apta para producción.
# ============================================================

FROM python:3.12-slim

# Metadatos
LABEL maintainer="edu-lab"
LABEL description="Aplicación web vulnerable para laboratorio educativo"

# Directorio de trabajo
WORKDIR /app

# Instalar dependencias del sistema para psycopg2
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Copiar y instalar dependencias Python
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código del backend
COPY backend/ .

# Copiar frontend estático
COPY frontend/ ./frontend/

# Script de espera para PostgreSQL
COPY wait-for-db.sh /wait-for-db.sh
RUN chmod +x /wait-for-db.sh

# Puerto de exposición
EXPOSE 5000

# Comando de inicio (espera a que la BD esté lista)
CMD ["/wait-for-db.sh", "db", "5432", "python", "app.py"]

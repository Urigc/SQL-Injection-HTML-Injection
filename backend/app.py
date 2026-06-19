"""
============================================================
  GOV-PORTAL — Backend Flask
  ADVERTENCIA EDUCATIVA:
  Esta aplicación contiene vulnerabilidades INTENCIONALES:
    1. SQL Injection en el login (concatenación directa de strings)
    2. HTML Injection en comentarios (sin sanitización ni escape)
  SOLO para uso en entornos locales y aislados.
  NO desplegar en producción ni en redes públicas.
============================================================
"""

import os
import psycopg2
from flask import Flask, request, jsonify, session
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")

app.secret_key = os.getenv("FLASK_SECRET_KEY", "insecure_default_key")

# ── Conexión a PostgreSQL ────────────────────────────────────────────────────

def get_db():
    """Abre una conexión nueva a la base de datos."""
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "db"),
        port=os.getenv("POSTGRES_PORT", 5432),
        dbname=os.getenv("POSTGRES_DB", "usa_gov_db"),
        user=os.getenv("POSTGRES_USER", "gov_user"),
        password=os.getenv("POSTGRES_PASSWORD", "gov_pass_2024"),
    )


# ── Rutas de páginas HTML ────────────────────────────────────────────────────

@app.route("/")
def index():
    return app.send_static_file("index.html")


@app.route("/login")
def login_page():
    return app.send_static_file("login.html")


@app.route("/confidential")
def confidential_page():
    if not session.get("logged_in"):
        return app.send_static_file("login.html"), 403
    return app.send_static_file("confidential.html")


# ── API: Autenticación ───────────────────────────────────────────────────────

@app.route("/api/login", methods=["POST"])
def api_login():
    """
    VULNERABILIDAD #1 — SQL INJECTION
    ─────────────────────────────────
    La consulta se construye con concatenación directa de strings.
    No se usan consultas parametrizadas ni ORM.

    Ejemplo de payload malicioso:
        username: admin' --
        password: cualquiercosa

    Consulta resultante:
        SELECT * FROM usuarios
        WHERE username = 'admin' --' AND password = 'cualquiercosa'
    El "--" comenta el resto de la consulta → bypass de autenticación.
    """
    data = request.get_json()
    username = data.get("username", "")
    password = data.get("password", "")

    # ⚠️ INSEGURO: concatenación directa — vulnerable a SQL Injection
    query = (
        "SELECT * FROM usuarios "
        "WHERE username = '" + username + "' "
        "AND password = '" + password + "'"
    )

    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(query)           # ← Punto de inyección
        user = cur.fetchone()
        cur.close()
        conn.close()
    except Exception as e:
        # Devuelve el error SQL al cliente (información útil para el atacante)
        return jsonify({"success": False, "error": str(e), "query": query}), 400

    if user:
        session["logged_in"] = True
        session["username"] = user[1]   # columna username
        session["rol"] = user[3]        # columna rol
        return jsonify({
            "success": True,
            "username": user[1],
            "rol": user[3],
            "query_ejecutada": query,   # ⚠️ Expone la query al cliente
        })
    else:
        return jsonify({
            "success": False,
            "message": "Credenciales incorrectas.",
            "query_ejecutada": query,   # ⚠️ Expone la query al cliente
        }), 401


@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"success": True})


# ── API: Documentos confidenciales ──────────────────────────────────────────

@app.route("/api/documentos", methods=["GET"])
def api_documentos():
    if not session.get("logged_in"):
        return jsonify({"error": "No autorizado"}), 401

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, titulo, contenido, clasificacion, creado_en FROM documentos_confidenciales ORDER BY id")
    rows = cur.fetchall()
    cur.close()
    conn.close()

    documentos = [
        {"id": r[0], "titulo": r[1], "contenido": r[2], "clasificacion": r[3], "creado_en": str(r[4])}
        for r in rows
    ]
    return jsonify(documentos)


# ── API: Comentarios (HTML Injection) ────────────────────────────────────────

@app.route("/api/comentarios", methods=["GET"])
def api_comentarios():
    if not session.get("logged_in"):
        return jsonify({"error": "No autorizado"}), 401

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, autor, contenido_html, creado_en FROM comentarios ORDER BY creado_en DESC")
    rows = cur.fetchall()
    cur.close()
    conn.close()

    comentarios = [
        {"id": r[0], "autor": r[1], "contenido_html": r[2], "creado_en": str(r[3])}
        for r in rows
    ]
    return jsonify(comentarios)


@app.route("/api/comentarios", methods=["POST"])
def api_comentarios_post():
    """
    VULNERABILIDAD #2 — HTML INJECTION
    ────────────────────────────────────
    El contenido se almacena en la BD sin ninguna sanitización.
    Al recuperarse, se renderiza directamente como innerHTML en el navegador.
    Esto permite inyectar cualquier etiqueta HTML arbitraria.

    Ejemplo de payload:
        autor: hacker
        contenido_html: <h1>INYECTADO</h1><img src=x onerror=alert('XSS')>
    """
    if not session.get("logged_in"):
        return jsonify({"error": "No autorizado"}), 401

    data = request.get_json()
    autor = data.get("autor", "Anónimo")
    # ⚠️ INSEGURO: contenido HTML sin escapar ni sanitizar
    contenido_html = data.get("contenido_html", "")

    conn = get_db()
    cur = conn.cursor()
    # ⚠️ TAMBIÉN inseguro: concatenación directa (doble vulnerabilidad)
    query = (
        "INSERT INTO comentarios (autor, contenido_html) "
        "VALUES ('" + autor + "', '" + contenido_html.replace("'", "''") + "')"
    )
    cur.execute(query)
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"success": True, "mensaje": "Comentario guardado."})


@app.route("/api/sesion", methods=["GET"])
def api_sesion():
    """Devuelve información de la sesión actual."""
    if session.get("logged_in"):
        return jsonify({
            "logged_in": True,
            "username": session.get("username"),
            "rol": session.get("rol"),
        })
    return jsonify({"logged_in": False})


# ── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(
        host=os.getenv("FLASK_HOST", "0.0.0.0"),
        port=int(os.getenv("FLASK_PORT", 5000)),
        debug=True,
    )

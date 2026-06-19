/**
 * GOV-PORTAL — Frontend Scripts
 * Maneja login, logout, documentos y comentarios (HTML Injection demo).
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function showFeedback(elementId, message, type = "error") {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.className = `feedback ${type}`;
  el.textContent = message;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 6000);
}

// ── Login ─────────────────────────────────────────────────────────────────────

async function doLogin() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const btn = document.getElementById("btn-login");

  if (!username) {
    showFeedback("login-feedback", "Ingresa un nombre de usuario.", "error");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Autenticando...";

  try {
    const resp = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await resp.json();

    // Mostrar la query SQL ejecutada (debug educativo)
    const sqlDebug = document.getElementById("sql-debug");
    const sqlText = document.getElementById("sql-query-text");
    if (sqlDebug && sqlText && data.query_ejecutada) {
      sqlText.textContent = data.query_ejecutada;
      sqlDebug.classList.remove("hidden");
    }

    if (data.success) {
      showFeedback("login-feedback", `✅ Acceso concedido. Bienvenido, ${data.username} (${data.rol})`, "success");
      setTimeout(() => {
        window.location.href = "/confidential";
      }, 1200);
    } else {
      showFeedback(
        "login-feedback",
        data.error
          ? `❌ Error SQL: ${data.error}`
          : "❌ Credenciales incorrectas.",
        "error"
      );
    }
  } catch (err) {
    showFeedback("login-feedback", `❌ Error de red: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">🔓</span> AUTENTICAR';
  }
}

// Permitir login con Enter
document.addEventListener("DOMContentLoaded", () => {
  ["username", "password"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("keydown", (e) => e.key === "Enter" && doLogin());
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────

async function doLogout() {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/";
}

// ── Sesión y Navegación ───────────────────────────────────────────────────────

async function initConfidentialPage() {
  // Verificar sesión
  try {
    const resp = await fetch("/api/sesion");
    const data = await resp.json();

    if (!data.logged_in) {
      window.location.href = "/login";
      return;
    }

    const navInfo = document.getElementById("nav-user-info");
    if (navInfo) {
      navInfo.textContent = `👤 ${data.username} · ${data.rol?.toUpperCase()}`;
    }
  } catch (e) {
    window.location.href = "/login";
    return;
  }

  loadDocumentos();
  loadComentarios();
}

// ── Documentos Clasificados ───────────────────────────────────────────────────

async function loadDocumentos() {
  const container = document.getElementById("documentos-container");
  if (!container) return;

  try {
    const resp = await fetch("/api/documentos");
    if (!resp.ok) { window.location.href = "/login"; return; }
    const docs = await resp.json();

    if (docs.length === 0) {
      container.innerHTML = '<p class="empty-state">No hay documentos disponibles.</p>';
      return;
    }

    container.innerHTML = docs
      .map(
        (doc) => `
      <div class="doc-card">
        <div class="doc-card-header">
          <span class="badge badge-${doc.clasificacion === "TOP SECRET" ? "red" : "orange"}">
            ${doc.clasificacion}
          </span>
          <span class="doc-id">#${doc.id}</span>
        </div>
        <h3 class="doc-title">${escapeHtml(doc.titulo)}</h3>
        <p class="doc-content">${escapeHtml(doc.contenido)}</p>
        <div class="doc-footer">
          <span class="doc-date">📅 ${new Date(doc.creado_en).toLocaleDateString("es-MX")}</span>
        </div>
      </div>`
      )
      .join("");
  } catch (err) {
    container.innerHTML = `<p class="error-state">Error al cargar documentos: ${err.message}</p>`;
  }
}

// ── Comentarios / HTML Injection ──────────────────────────────────────────────

async function loadComentarios() {
  const container = document.getElementById("comments-container");
  if (!container) return;

  try {
    const resp = await fetch("/api/comentarios");
    if (!resp.ok) return;
    const comments = await resp.json();

    if (comments.length === 0) {
      container.innerHTML = '<p class="empty-state">No hay entradas en la bitácora.</p>';
      return;
    }

    container.innerHTML = comments
      .map(
        (c) => `
      <div class="comment-card">
        <div class="comment-header">
          <span class="comment-author">👤 ${escapeHtml(c.autor)}</span>
          <span class="comment-date">🕐 ${new Date(c.creado_en).toLocaleString("es-MX")}</span>
        </div>
        <div class="comment-body">
          <!--
            ⚠️ VULNERABILIDAD HTML INJECTION:
            El contenido se inserta como innerHTML SIN sanitizar.
            Cualquier etiqueta HTML en 'contenido_html' será renderizada.
          -->
          <div class="html-injection-zone">${c.contenido_html}</div>
        </div>
      </div>`
      )
      .join("");
  } catch (err) {
    container.innerHTML = `<p class="error-state">Error al cargar bitácora: ${err.message}</p>`;
  }
}

async function submitComment() {
  const autor = document.getElementById("comment-autor")?.value.trim() || "Anónimo";
  const contenido = document.getElementById("comment-content")?.value || "";

  if (!contenido.trim()) {
    showFeedback("comment-feedback", "El contenido no puede estar vacío.", "error");
    return;
  }

  try {
    const resp = await fetch("/api/comentarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autor, contenido_html: contenido }),
    });
    const data = await resp.json();

    if (data.success) {
      showFeedback("comment-feedback", "✅ Entrada guardada en la bitácora.", "success");
      document.getElementById("comment-autor").value = "";
      document.getElementById("comment-content").value = "";
      loadComentarios(); // Recargar comentarios
    } else {
      showFeedback("comment-feedback", `❌ Error: ${data.error}`, "error");
    }
  } catch (err) {
    showFeedback("comment-feedback", `❌ Error de red: ${err.message}`, "error");
  }
}

// ── Payloads de Ejemplo ───────────────────────────────────────────────────────

function loadPayloadExample() {
  const helper = document.getElementById("payload-helper");
  if (helper) helper.style.display = helper.style.display === "none" ? "block" : "none";
}

const PAYLOADS = {
  h1: `<h1 style="color:red; text-align:center;">🚨 SISTEMA COMPROMETIDO 🚨</h1>
<p style="font-size:18px; color:#ff6600;">Este contenido fue inyectado mediante <strong>HTML Injection</strong>.</p>
<hr style="border:2px dashed red;">`,

  img: `<div style="text-align:center; padding:10px;">
  <img src="https://picsum.photos/400/200?random=42" alt="Imagen inyectada"
       style="border:3px solid red; border-radius:8px;" />
  <p style="color:red;"><em>Imagen cargada desde URL externa vía HTML Injection</em></p>
</div>`,

  video: `<div style="text-align:center; padding:10px;">
  <p style="color:orange; font-weight:bold;">📹 Video inyectado:</p>
  <video width="400" controls style="border:2px solid orange; border-radius:8px;">
    <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4" />
    Tu navegador no soporta video HTML5.
  </video>
</div>`,

  iframe: `<div style="padding:10px;">
  <p style="color:purple; font-weight:bold;">🖼️ iFrame inyectado (carga página externa):</p>
  <iframe
    src="https://example.com"
    width="100%" height="300"
    style="border:2px solid purple; border-radius:8px;"
    title="iFrame inyectado">
  </iframe>
</div>`,

  form: `<div style="background:#1a1a2e; padding:20px; border-radius:8px; border:2px solid #ff0066;">
  <h3 style="color:#ff0066;">⚠️ Formulario falso de re-autenticación</h3>
  <p style="color:#ccc; font-size:13px;">Inyectado mediante HTML Injection — simula phishing</p>
  <label style="color:#aaa; display:block; margin-top:10px;">Usuario:</label>
  <input type="text" placeholder="Ingresa tu usuario"
         style="width:100%;padding:8px;margin:5px 0;background:#0d0d1a;color:white;border:1px solid #ff0066;border-radius:4px;" />
  <label style="color:#aaa; display:block; margin-top:5px;">Contraseña:</label>
  <input type="password" placeholder="••••••••"
         style="width:100%;padding:8px;margin:5px 0;background:#0d0d1a;color:white;border:1px solid #ff0066;border-radius:4px;" />
  <button onclick="alert('Formulario capturado (demo educativo)')"
          style="margin-top:10px;padding:8px 20px;background:#ff0066;color:white;border:none;border-radius:4px;cursor:pointer;">
    Verificar identidad
  </button>
</div>`,

  table: `<div style="padding:10px; overflow-x:auto;">
  <h3 style="color:#00ff88;">📊 Tabla de datos inyectada</h3>
  <table style="width:100%;border-collapse:collapse;color:#e0e0e0;font-size:14px;">
    <thead>
      <tr style="background:#1a3a1a;">
        <th style="border:1px solid #00ff88;padding:8px;">ID</th>
        <th style="border:1px solid #00ff88;padding:8px;">Agente</th>
        <th style="border:1px solid #00ff88;padding:8px;">Misión</th>
        <th style="border:1px solid #00ff88;padding:8px;">Estado</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border:1px solid #333;padding:8px;text-align:center;">001</td>
        <td style="border:1px solid #333;padding:8px;">Agente X</td>
        <td style="border:1px solid #333;padding:8px;">Op. Sombra</td>
        <td style="border:1px solid #333;padding:8px;color:#00ff88;">ACTIVO</td>
      </tr>
      <tr>
        <td style="border:1px solid #333;padding:8px;text-align:center;">002</td>
        <td style="border:1px solid #333;padding:8px;">[REDACTADO]</td>
        <td style="border:1px solid #333;padding:8px;">Op. Fénix</td>
        <td style="border:1px solid #333;padding:8px;color:#ff6600;">EN CAMPO</td>
      </tr>
    </tbody>
  </table>
</div>`,
};

function insertPayload(type) {
  const textarea = document.getElementById("comment-content");
  if (textarea && PAYLOADS[type]) {
    textarea.value = PAYLOADS[type];
  }
}

// ── Utilidades ────────────────────────────────────────────────────────────────

/** Escapa HTML para mostrar contenido de forma segura (usado en documentos). */
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.classList.contains("page-confidential")) {
    initConfidentialPage();
  }
});

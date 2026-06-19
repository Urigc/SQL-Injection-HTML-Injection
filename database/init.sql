

-- Tabla 1: Usuarios del sistema
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password TEXT NOT NULL,
    rol VARCHAR(50) DEFAULT 'agente',
    creado_en TIMESTAMP DEFAULT NOW()
);

-- Tabla 2: Documentos clasificados
CREATE TABLE documentos_confidenciales (
    id SERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    contenido TEXT,
    clasificacion VARCHAR(50) DEFAULT 'TOP SECRET',
    creado_en TIMESTAMP DEFAULT NOW()
);

-- Tabla 3: Comentarios / bitácora (vulnerable a HTML Injection)
CREATE TABLE comentarios (
    id SERIAL PRIMARY KEY,
    autor TEXT NOT NULL,
    contenido_html TEXT,
    creado_en TIMESTAMP DEFAULT NOW()
);

-- ============================================================
--  Datos de prueba — credenciales en texto plano (inseguro)
-- ============================================================

INSERT INTO usuarios (username, password, rol) VALUES
    ('admin',   'admin123',       'superadmin'),
    ('agent47',  's3cr3t_007',    'agente'),
    ('director', 'G0v2024!',      'director');

-- Documentos ficticios clasificados
INSERT INTO documentos_confidenciales (titulo, contenido, clasificacion) VALUES
    ('Operación Sombra Nocturna',
     'Fase 1: Infiltración en sector norte. Coordenadas: 38.8951° N, 77.0364° W. Activos desplegados: 7. Estado: ACTIVO.',
     'TOP SECRET'),

    ('Protocolo Fénix — Contingencia Alpha',
     'En caso de brecha en el perímetro digital, activar protocolo de cierre total de red interna. Contactar al director en línea segura: ext. 7741.',
     'SECRET'),

    ('Informe de Inteligencia — Trimestre Q3',
     'Actividad inusual detectada en 3 nodos de comunicación. Se sospecha de filtración interna. Investigación en curso por el Departamento de Seguridad Interna.',
     'CONFIDENTIAL'),

    ('Lista de Activos — Clasificada',
     'Nombre: [REDACTADO] | ID: USG-9921 | Misión: [REDACTADO] | Estado: EN CAMPO\nNombre: [REDACTADO] | ID: USG-4432 | Misión: [REDACTADO] | Estado: EXFILTRADO',
     'TOP SECRET');

-- Comentarios iniciales de ejemplo
INSERT INTO comentarios (autor, contenido_html) VALUES
    ('Sistema', 'Portal de acceso inicializado correctamente.'),
    ('admin',   'Revisión de seguridad programada para el viernes.');

-- =========================================================================
-- PROYECTO FINAL: Sistema de Pruebas de Vida (Liveness Detection)
-- Grupo 4 - Proyect05 (CASATIC / UGB)
-- Script de Base de Datos: Tablas, Relaciones, Índices y Datos Semilla
-- =========================================================================

-- 1. Tabla de Roles del Sistema
CREATE TABLE IF NOT EXISTS Roles (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Nombre VARCHAR(50) NOT NULL UNIQUE,
    Descripcion VARCHAR(255),
    FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Usuarios y Operadores
CREATE TABLE IF NOT EXISTS Usuarios (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    RolId INTEGER NOT NULL,
    NombreCompleto VARCHAR(120) NOT NULL,
    Email VARCHAR(120) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    MfaHabilitado BOOLEAN DEFAULT 0,
    MfaSecretKey VARCHAR(100),
    Activo BOOLEAN DEFAULT 1,
    FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    UltimoAcceso DATETIME,
    FOREIGN KEY (RolId) REFERENCES Roles(Id) ON DELETE RESTRICT
);

-- 3. Tabla de Solicitudes de Verificación
CREATE TABLE IF NOT EXISTS SolicitudesVerificacion (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    CodigoSolicitud VARCHAR(64) NOT NULL UNIQUE,
    UsuarioSolicitanteId INTEGER,
    NombrePersona VARCHAR(120) NOT NULL,
    NumeroDocumento VARCHAR(30) NOT NULL,
    TipoDocumento VARCHAR(20) NOT NULL DEFAULT 'DUI', -- DUI, PASAPORTE, LICENCIA
    Estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, EN_PROCESO, APROBADO, RECHAZADO, REVISION_MANUAL, BLOQUEADO
    IntentosRestantes INTEGER NOT NULL DEFAULT 3,
    ConsentimientoAceptado BOOLEAN NOT NULL DEFAULT 1,
    FechaConsentimiento DATETIME DEFAULT CURRENT_TIMESTAMP,
    ScoreSimilitudFacial REAL DEFAULT 0.0,
    ScoreLivenessGlobal REAL DEFAULT 0.0,
    Observaciones VARCHAR(500),
    RevisadoPorUsuarioId INTEGER,
    FechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FechaFinalizacion DATETIME,
    FOREIGN KEY (UsuarioSolicitanteId) REFERENCES Usuarios(Id) ON DELETE SET NULL,
    FOREIGN KEY (RevisadoPorUsuarioId) REFERENCES Usuarios(Id) ON DELETE SET NULL
);

-- 4. Tabla de Documentos Oficiales
CREATE TABLE IF NOT EXISTS DocumentosIdentidad (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    SolicitudId INTEGER NOT NULL,
    TipoDocumento VARCHAR(20) NOT NULL,
    NumeroDocumento VARCHAR(30) NOT NULL,
    NombreTitular VARCHAR(120),
    FechaNacimiento VARCHAR(20),
    FechaExpiracion VARCHAR(20),
    RutaArchivoHash VARCHAR(255) NOT NULL,
    RostroDocumentoBase64 TEXT,
    EmbeddingDocumento TEXT, -- Vector de 128 o 512 dimensiones serializado en JSON
    OcrDatosExtraidos TEXT,
    FormatoValido BOOLEAN DEFAULT 1,
    DimensionesValidas BOOLEAN DEFAULT 1,
    FechaCarga DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (SolicitudId) REFERENCES SolicitudesVerificacion(Id) ON DELETE CASCADE
);

-- 5. Tabla de Catálogo de Retos de Vida Dinámicos
CREATE TABLE IF NOT EXISTS RetosLiveness (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    CodigoReto VARCHAR(40) NOT NULL UNIQUE,
    NombreReto VARCHAR(100) NOT NULL,
    InstruccionUsuario VARCHAR(255) NOT NULL,
    TiempoLimiteSegundos INTEGER NOT NULL DEFAULT 15,
    IconoClave VARCHAR(40) DEFAULT 'eye'
);

-- 6. Tabla de Intentos de Verificación Biométrica
CREATE TABLE IF NOT EXISTS IntentosVerificacion (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    SolicitudId INTEGER NOT NULL,
    NumeroIntento INTEGER NOT NULL,
    DispositivoUserAgent VARCHAR(255),
    DireccionIP VARCHAR(64),
    SecuenciaRetosAsignada TEXT, -- JSON con IDs de retos asignados
    SecuenciaRetosCumplida BOOLEAN DEFAULT 0,
    ParpadeoDetectado BOOLEAN DEFAULT 0,
    GiroCabezaDetectado BOOLEAN DEFAULT 0,
    SonrisaDetectada BOOLEAN DEFAULT 0,
    LecturaCodigoDetectada BOOLEAN DEFAULT 0,
    AnalisisTexturaLaplaciana REAL DEFAULT 0.0,
    AnalisisDiferenciaFotogramas REAL DEFAULT 0.0,
    ScoreLiveness REAL DEFAULT 0.0,
    ScoreSimilitudFacial REAL DEFAULT 0.0,
    EsSospechaPantalla BOOLEAN DEFAULT 0,
    EsSospechaFotoImpresa BOOLEAN DEFAULT 0,
    EsSospechaMascara BOOLEAN DEFAULT 0,
    ResultadoIntento VARCHAR(30) NOT NULL, -- EXITOSO, FALLIDO_LIVENESS, FALLIDO_SIMILITUD, TIMEOUT, ANOMALIA
    DuracionSegundos REAL DEFAULT 0.0,
    FechaIntento DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (SolicitudId) REFERENCES SolicitudesVerificacion(Id) ON DELETE CASCADE
);

-- 7. Tabla Inmutable de Logs de Auditoría (Append-Only)
CREATE TABLE IF NOT EXISTS LogsAuditoria (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    SolicitudId INTEGER,
    UsuarioId INTEGER,
    Evento VARCHAR(80) NOT NULL, -- INICIO_SESION, SOLICITUD_CREADA, RETO_PRESENTADO, FRAME_ANALIZADO, VERIFICACION_APROBADA, FRAUDE_DETECTADO, REVISION_MANUAL
    NivelSeveridad VARCHAR(20) NOT NULL DEFAULT 'INFO', -- INFO, WARNING, ERROR, CRITICAL
    Detalle TEXT NOT NULL,
    HashIntegridad VARCHAR(64) NOT NULL, -- SHA-256 encadenado para garantizar inmutabilidad
    DireccionIP VARCHAR(64),
    UserAgent VARCHAR(255),
    FechaRegistro DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tabla de Configuración de Retención y Parámetros Biométricos (GDPR / Privacidad)
CREATE TABLE IF NOT EXISTS ConfiguracionSistema (
    Clave VARCHAR(50) PRIMARY KEY,
    Valor VARCHAR(255) NOT NULL,
    Descripcion VARCHAR(255),
    FechaModificacion DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- ÍNDICES DE RENDIMIENTO Y CONSULTA
-- =========================================================================
CREATE INDEX IF NOT EXISTS IX_Solicitudes_Codigo ON SolicitudesVerificacion(CodigoSolicitud);
CREATE INDEX IF NOT EXISTS IX_Solicitudes_Estado ON SolicitudesVerificacion(Estado);
CREATE INDEX IF NOT EXISTS IX_Solicitudes_Fecha ON SolicitudesVerificacion(FechaCreacion);
CREATE INDEX IF NOT EXISTS IX_Intentos_Solicitud ON IntentosVerificacion(SolicitudId);
CREATE INDEX IF NOT EXISTS IX_Auditoria_Fecha ON LogsAuditoria(FechaRegistro);
CREATE INDEX IF NOT EXISTS IX_Auditoria_Evento ON LogsAuditoria(Evento);

-- =========================================================================
-- DATOS SEMILLA (ROLES, RETOS, CONFIGURACIÓN Y USUARIO ADMINISTRADOR)
-- =========================================================================

-- Roles
INSERT OR IGNORE INTO Roles (Id, Nombre, Descripcion) VALUES 
(1, 'Administrador', 'Control total de plataforma, auditoría y políticas'),
(2, 'OficialVerificacion', 'Revisión manual de verificaciones dudosas y reportes'),
(3, 'UsuarioCliente', 'Usuario final solicitante de verificación');

-- Retos de liveness
INSERT OR IGNORE INTO RetosLiveness (Id, CodigoReto, NombreReto, InstruccionUsuario, TiempoLimiteSegundos, IconoClave) VALUES
(1, 'PARPADEO_DOBLE', 'Parpadeo doble', 'Parpadea lentamente dos veces mirando la cámara', 12, 'blink'),
(2, 'GIRO_DERECHA', 'Giro a la derecha', 'Gira suavemente la cabeza hacia tu derecha', 12, 'arrow-right'),
(3, 'GIRO_IZQUIERDA', 'Giro a la izquierda', 'Gira suavemente la cabeza hacia tu izquierda', 12, 'arrow-left'),
(4, 'SONREIR', 'Sonrisa natural', 'Sonríe ligeramente y vuelve a la expresión neutra', 10, 'smile'),
(5, 'LECTURA_CODIGO', 'Lectura de código', 'Pronuncia o asiente ante el código aleatorio mostrado', 15, 'code');

-- Configuración de seguridad, retención y biométrica
INSERT OR IGNORE INTO ConfiguracionSistema (Clave, Valor, Descripcion) VALUES
('UMBRAL_SIMILITUD_MINIMA', '0.75', 'Umbral mínimo de similitud facial coseno (0.0 a 1.0) para aprobación directa'),
('UMBRAL_REVISION_MANUAL', '0.60', 'Umbral por debajo del cual pasa a revisión manual en vez de rechazo directo'),
('UMBRAL_LIVENESS_MINIMO', '0.70', 'Score mínimo de prueba de vida requerido para validar presencia'),
('MAX_INTENTOS_POR_SOLICITUD', '3', 'Cantidad máxima de intentos antes de bloqueo'),
('TIEMPO_BLOQUEO_MINUTOS', '15', 'Minutos de enfriamiento si se consumen los intentos'),
('DIAS_RETENCION_BIOMETRICA', '30', 'Días máximos de retención de imágenes antes de purga automática'),
('MFA_OBLIGATORIO_ADMIN', 'true', 'Requiere doble factor de autenticación para panel admin');

-- Usuarios iniciales: NO se siembran por SQL. La aplicacion los crea al arrancar (DbInitializer)
-- con hash PBKDF2. Este script es de referencia; la BD real la genera EF Core (EnsureCreated).

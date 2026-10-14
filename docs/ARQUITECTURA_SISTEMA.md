# Diseño de Arquitectura Técnica del Sistema
## Sistema de Pruebas de Vida (Liveness Detection) y Verificación de Identidad
**Proyecto:** Proyect05 - Grupo 4 | CASATIC / UGB

---

### 1. Visión General de la Arquitectura
El sistema adopta una arquitectura en capas basada en microservicios modulares y principios RESTful, con una separación clara entre la interfaz de cliente (Frontend SPA Vanilla / Canvas / WebRTC) y el backend de procesamiento biométrico y de negocio (.NET 8 ASP.NET Core Web API).

```mermaid
flowchart TD
    subgraph Cliente ["Capa de Presentación (Frontend SPA)"]
        UI["Interfaz Web (HTML5/CSS3)"]
        CamMod["Módulo Cámara (WebRTC API)"]
        LivEngine["Motor Heurístico de Visión (Canvas 2D)"]
        ApiCli["Cliente API REST (Fetch)"]
        UI --> CamMod
        CamMod --> LivEngine
        LivEngine --> ApiCli
    end

    subgraph API_Gateway ["Capa de Exposición y Seguridad"]
        GW["ASP.NET Core Web API (Kestrel)"]
        CORS["CORS Policy"]
        JWT["Autenticación JWT Bearer"]
        Swagger["Documentación OpenAPI / Swagger"]
        GW --> CORS
        GW --> JWT
        GW --> Swagger
    end

    subgraph Servicios ["Capa de Lógica y Procesamiento Biométrico"]
        LivSvc["LivenessService (Retos, Flujo Óptico y Textura)"]
        FaceSvc["FaceComparisonService (Similitud Coseno de Embeddings)"]
        DocSvc["DocumentValidationService (Validación DUI/OCR)"]
        AuditSvc["AuditService (Logs Inmutables SHA-256)"]
        NotifSvc["NotificationService (Alertas Operativas)"]
    end

    subgraph Persistencia ["Capa de Datos y Almacenamiento"]
        EF["Entity Framework Core"]
        DB[("Base de Datos Relacional SQLite / SQL Server")]
        AuditLogStore[("Almacén Inmutable de Auditoría")]
        EF --> DB
        EF --> AuditLogStore
    end

    subgraph Externos ["Sistemas Externos Integrables"]
        BankAPI["Core Bancario / Plataforma de Autenticación"]
        RNP["Base de Datos Gubernamental / Validación de Identidad"]
    end

    ApiCli -->|HTTPS / JSON REST| GW
    GW --> LivSvc
    GW --> FaceSvc
    GW --> DocSvc
    GW --> AuditSvc
    GW --> NotifSvc

    LivSvc --> EF
    FaceSvc --> EF
    DocSvc --> EF
    AuditSvc --> EF

    GW -.->|Webhooks / REST Seguro| BankAPI
    DocSvc -.->|Consulta de Registro| RNP
```

---

### 2. Diagrama de Flujo de Verificación (Secuencia)
El siguiente diagrama detalla la interacción paso a paso entre el Usuario, el Frontend, los Servicios Backend y la Base de Datos.

```mermaid
sequenceDiagram
    autonumber
    actor Usuario
    participant Frontend as Cliente Web (SPA)
    participant API as VerificationController
    participant LivenessSvc as LivenessService
    participant FaceSvc as FaceComparisonService
    participant DocSvc as DocumentValidationService
    participant DB as Base de Datos

    Usuario->>Frontend: Ingresa datos y acepta consentimiento
    Usuario->>Frontend: Sube foto de documento (DUI)
    Frontend->>API: POST /api/verification/create
    API->>DB: Crea registro en estado PENDIENTE
    Frontend->>API: POST /api/verification/upload-document
    API->>DocSvc: Valida formato, DPI y extrae embedding
    DocSvc-->>API: Documento válido
    API->>DB: Guarda documento y actualiza a EN_PROCESO

    Frontend->>API: GET /api/liveness/challenges/{codigo}
    API->>LivenessSvc: Genera secuencia aleatoria (2-3 retos)
    LivenessSvc-->>Frontend: Retos (Parpadeo, Giro, Sonrisa) con timeouts

    loop Durante cada reto biométrico
        Frontend->>Frontend: Evalúa micro-movimientos, brillo y parpadeo en Canvas
        Frontend->>Usuario: Muestra retroalimentación visual en óvalo y temporizador
    end

    Frontend->>Frontend: Captura snapshot de mejor fotograma facial
    Frontend->>API: POST /api/verification/submit-attempt (Frames + Telemetría)
    
    API->>LivenessSvc: Evalúa viveza, micro-movimientos y sospecha de pantalla
    API->>FaceSvc: Compara embeddings de rostro en vivo vs rostro documento
    FaceSvc-->>API: Score similitud y clasificación (Aprobado / Manual / Rechazado)
    
    API->>DB: Registra intento inmutable y actualiza estado de solicitud
    API-->>Frontend: Dictamen final (Scores + Estado + Mensaje)
    Frontend->>Usuario: Presenta resultado en modal interactivo
```

---

### 3. Diagrama de Estados de la Solicitud
```mermaid
stateDiagram-v2
    [*] --> PENDIENTE: Usuario inicia solicitud
    PENDIENTE --> EN_PROCESO: Documento oficial validado y cargado
    
    state EN_PROCESO {
        [*] --> EJECUTANDO_RETOS
        EJECUTANDO_RETOS --> ANALIZANDO_BIOMETRIA
    }

    EN_PROCESO --> APROBADO: Liveness >= 0.70 AND Similitud >= 0.75
    EN_PROCESO --> REVISION_MANUAL: Liveness >= 0.70 AND 0.60 <= Similitud < 0.75
    EN_PROCESO --> RECHAZADO: Similitud < 0.60 OR Fraude detectado
    EN_PROCESO --> BLOQUEADO: 3 intentos fallidos consecutivos

    REVISION_MANUAL --> APROBADO: Oficial valida manualmente identidad
    REVISION_MANUAL --> RECHAZADO: Oficial rechaza tras inspección

    APROBADO --> [*]
    RECHAZADO --> [*]
    BLOQUEADO --> [*]
```

---

### 4. Descripción de Componentes Clave

1. **Capa Cliente (Frontend SPA):**
   - Construida en Vanilla JavaScript modular (ES6+), sin sobrecargas de dependencias externas.
   - Utiliza la **WebRTC MediaStream API** para obtener video nativo a 30 FPS.
   - Utiliza la **HTML5 Canvas 2D API** con directiva `willReadFrequently: true` para ejecutar cálculos de visión por computadora en el hilo de renderizado sin congelar la interfaz.
   - Proyecta un óvalo dinámico que cambia de color según la calidad de la iluminación y la distancia.

2. **Capa de Control y Exposición (ASP.NET Core Web API):**
   - Controladores RESTful fuertemente tipados.
   - Generación de contratos interactivos mediante Swagger UI.
   - Políticas CORS restrictivas y middleware de manejo global de excepciones.
   - Autenticación JWT con esquema Bearer para roles administrativos y de auditoría.

3. **Motor de Liveness (C# & JS Híbrido):**
   - En cliente: Detección en tiempo real de parpadeos y giros para guiar al usuario.
   - En servidor: Validación de telemetría inter-frame, distribución temporal y detección de patrones de fraude (ausencia de micro-movimiento o saltos temporales sospechosos).

4. **Motor de Comparación Facial:**
   - Vectorización de rasgos faciales a 128 dimensiones con normalización $L_2$.
   - Comparación mediante producto punto normalizado (Similitud Coseno).
   - Zona gris configurable para mitigar falsos rechazos en fotos antiguas de documentos oficiales.

5. **Servicio Inmutable de Auditoría:**
   - Registro de cada intento, fallo, inicio de sesión y cambio de configuración.
   - Cálculo criptográfico de **SHA-256 encadenado** (cadena de hashes):
     $$\text{Hash}_i = \text{SHA256}(\text{Hash}_{i-1} \parallel \text{SolicitudId} \parallel \text{Evento} \parallel \text{Timestamp})$$
   - Esto garantiza que ningún registro pueda ser alterado retroactivamente sin romper la cadena.

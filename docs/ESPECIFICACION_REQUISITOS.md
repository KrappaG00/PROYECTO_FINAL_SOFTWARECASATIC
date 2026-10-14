# Especificación de Requisitos de Software (SRS)
## Sistema de Pruebas de Vida (Liveness Detection) y Verificación de Identidad
**Proyecto:** Proyect05 - Grupo 4  
**Entidad / Convenio:** CASATIC / Universidad Gerardo Barrios (UGB)  
**Versión:** 1.0.0 (Release Académico / Industrial)

---

### 1. Introducción y Propósito
El presente documento define la especificación formal de requisitos funcionales, no funcionales y reglas de negocio para el desarrollo e implementación del **Sistema de Pruebas de Vida (Liveness Detection) y Verificación de Identidad**. El sistema tiene como objetivo principal autenticar biométricamente que una persona física se encuentra real y conscientemente frente a la cámara en el momento exacto de la transacción digital, previniendo fraudes de suplantación de identidad mediante fotografías impresas, pantallas de dispositivos móviles, videos pregrabados o máscaras 3D.

### 2. Contexto de Aplicación
- Apertura remota de cuentas bancarias y billeteras electrónicas (Fintech).
- Autenticación reforzada (MFA biométrico) en trámites gubernamentales y legales.
- Acceso seguro a plataformas académicas, empresariales y servicios restringidos.
- Prevención de fraude en onboarding digital bajo normativas KYC (Know Your Customer) y AML.

---

### 3. Actores del Sistema
| Actor | Descripción |
| :--- | :--- |
| **Usuario Solicitante (Ciudadano/Cliente)** | Persona que somete su documento oficial y realiza la prueba de vida para validar su identidad. |
| **Oficial de Verificación (Operador)** | Personal autorizado que revisa solicitudes en "Zona Gris" o casos derivados a revisión manual. |
| **Administrador del Sistema** | Usuario con privilegios totales para gestionar roles, políticas de retención, umbrales y auditoría. |
| **Sistema / API Gateway Externo** | Servicios bancarios o plataformas de terceros que integran los endpoints REST de verificación. |

---

### 4. Requisitos Funcionales (RF)

#### RF-01: Captura Biométrica en Tiempo Real (WebRTC & Canvas)
- El sistema debe acceder a la cámara frontal del dispositivo mediante la API estándar `navigator.mediaDevices.getUserMedia`.
- Debe proyectar sobre el video un **overlay con guía facial ovalada** para orientar al usuario en la distancia y alineación correcta.
- Debe validar que la resolución sea al menos de 640x480 (ideal 1280x720) y que los fotogramas se capturen a una tasa mínima de 15 FPS.

#### RF-02: Control de Calidad del Entorno (Iluminación y Estabilidad)
- El cliente debe evaluar continuamente el histograma de luminancia (ITU-R BT.601) y alertar al usuario si la escena está subexpuesta (< 25%), sobreexpuesta (> 85%) o con contraluz severo.
- Debe medir la estabilidad del dispositivo y advertir ante vibraciones bruscas o cámara fuera de foco.

#### RF-03: Generación de Secuencia de Retos Aleatorios Dinámicos
- Al iniciar una sesión de prueba de vida, el backend debe generar aleatoriamente una secuencia no predictiva de 2 a 3 retos biométricos seleccionados del catálogo:
  1. *Parpadeo doble natural* (`PARPADEO_DOBLE`).
  2. *Giro suave de cabeza a la derecha* (`GIRO_DERECHA`).
  3. *Giro suave de cabeza a la izquierda* (`GIRO_IZQUIERDA`).
  4. *Sonrisa natural* (`SONREIR`).
  5. *Lectura o confirmación de código de seguridad efímero* (`LECTURA_CODIGO`).
- Cada reto debe contar con un tiempo límite individual (10 a 15 segundos) y un tiempo máximo global por intento no mayor a 45 segundos.

#### RF-04: Detección Heurística de Vida (Liveness Detection Engine)
- El motor debe analizar la **diferencia absoluta inter-frame** para validar micro-movimientos biológicos naturales.
- Debe detectar ataques estáticos (fotos en papel o cartón): si la variación entre fotogramas sucesivos es inferior a $\Delta = 0.003$, se catalogará como `FOTO_IMPRESA_DETECTADA`.
- Debe detectar ataques por pantalla o repetición: monitoreo de patrones de brillo no reactivos y reflejos anormales.
- El score de liveness global debe calcularse en una escala de 0.0 a 1.0.

#### RF-05: Carga y Validación de Documento Oficial
- El sistema debe admitir imágenes de Documento Único de Identidad (DUI de El Salvador) o Pasaporte.
- Formatos permitidos: JPG, PNG, WEBP (tamaño entre 10 KB y 8 MB).
- Validación de sintaxis salvadoreña: expresión regular para DUI (`^\d{8}-?\d{1}$`).
- Generación de hash criptográfico SHA-256 del archivo para trazabilidad y deduplicación.

#### RF-06: Comparación Facial Biométrica (Facial Matching)
- Extracción de vector de características faciales (embeddings de 128 dimensiones).
- Cálculo de similitud mediante la métrica de **Coseno**:
  $$\text{Similitud} = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\| \|\mathbf{v}\|}$$
- Comparación contra el umbral configurable del sistema.

#### RF-07: Registro Inmutable de Intentos y Auditoría
- Cada intento debe persistirse de forma inmutable (append-only) registrando: fecha, hora UTC, User-Agent, dirección IP, retos asignados, cumplimiento individual, scores biométricos y dictamen.
- Cada registro de log de auditoría debe incluir un **hash encadenado SHA-256** para evitar modificaciones o manipulaciones forenses posteriores.

#### RF-08: Panel de Administración y Filtros
- Listado centralizado de verificaciones con filtrado en tiempo real por: Estado (`APROBADO`, `RECHAZADO`, `REVISION_MANUAL`, `BLOQUEADO`), Tipo de Documento, Búsqueda por Nombre o Número de Documento.
- Módulo de configuración de umbrales y políticas de retención de datos.

#### RF-09: Generación de Reportes y Métricas
- Dashboard ejecutivo con indicadores clave (KPIs): Total solicitudes, porcentaje de aprobación, tasa de intentos sospechosos de fraude, tiempo promedio de respuesta.
- Exportación directa de datos históricos en formato CSV y resumen tabular.

#### RF-10: Notificaciones y Alertas Automáticas
- Notificación inmediata al usuario en la interfaz gráfica (modal con desglose de scores).
- Generación de alertas para los oficiales de cumplimiento ante detecciones de fraude o desvío a revisión manual.

---

### 5. Requisitos No Funcionales (RNF)

| Código | Categoría | Especificación |
| :--- | :--- | :--- |
| **RNF-01** | **Rendimiento** | El proceso completo de prueba de vida (captura, retos y dictamen) debe completarse en menos de **60 segundos** (promedio objetivo: < 30s). |
| **RNF-02** | **Seguridad** | Cifrado en tránsito mediante TLS 1.2 o superior. Contraseñas con PBKDF2-SHA256 y sal. MFA y refresh token: pendientes (ver ESTADO_Y_LIMITACIONES.md). Autenticación de endpoints administrativos mediante Tokens JWT. |
| **RNF-03** | **Privacidad (GDPR)** | Retención temporal máxima de datos biométricos parametrizable (por defecto 30 días). Solicitud de consentimiento informado explícito antes de encender la cámara. |
| **RNF-04** | **Escalabilidad** | Arquitectura desacoplada en capas (API RESTful + Frontend modular) lista para escalar horizontalmente mediante contenedores o workers asíncronos. |
| **RNF-05** | **Usabilidad** | Interfaz 100% en español técnico accesible, instrucciones visuales paso a paso, retroalimentación en tiempo real y diseño responsivo para móviles y escritorios. |
| **RNF-06** | **Trazabilidad** | Logs inmutables encadenados criptográficamente para auditoría forense bancaria. |
| **RNF-07** | **Compatibilidad** | Soporte para Google Chrome, Microsoft Edge, Mozilla Firefox y Safari basados en WebRTC y Canvas API. |

---

### 6. Reglas de Negocio (RN)

- **RN-01 (Límite de Intentos):** Cada solicitud de verificación permite un máximo estricto de **3 intentos**. Si se agotan sin éxito, la solicitud cambia irreversiblemente a estado `BLOQUEADO` durante un período de enfriamiento de 15 minutos.
- **RN-02 (Criterio de Aprobación Directa):** Una verificación se aprueba automáticamente si:
  $$\text{ScoreLiveness} \ge 0.70 \quad \text{y} \quad \text{ScoreSimilitudFacial} \ge 0.75$$
- **RN-03 (Zona Gris y Revisión Manual):** Si el liveness es válido ($\ge 0.70$) pero la similitud facial se encuentra en el rango de incertidumbre ($0.60 \le \text{Similitud} < 0.75$), el estado cambia a `REVISION_MANUAL` para que un oficial humano valide el caso.
- **RN-04 (Rechazo Inmediato por Fraude):** Si se detecta un patrón consistente con foto impresa (cero micro-movimiento), pantalla o manipulación temporal abusiva (< 2 segundos de respuesta), la verificación se cancela de inmediato bajo estado `RECHAZADO` por sospecha de fraude.
- **RN-05 (Consentimiento Obligatorio):** No se permite iniciar la captura de video ni registrar fotogramas sin la marcación afirmativa del checkbox de consentimiento legal informado.

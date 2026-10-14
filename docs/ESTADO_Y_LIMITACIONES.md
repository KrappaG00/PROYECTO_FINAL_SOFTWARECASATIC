# Estado del Proyecto, Limitaciones y Roadmap

## 1. Qué está implementado y verificado
- API ASP.NET Core 8 con EF Core + SQLite: solicitudes, documentos, intentos, auditoría, configuración.
- Retos aleatorios (2–3) generados en el servidor con tiempo límite por reto.
- Reglas de negocio: 3 intentos, estados finales, consentimiento obligatorio, zona gris → revisión manual, rechazo por imagen estática.
- Seguridad: contraseñas con PBKDF2-SHA256 (600 000 iteraciones, sal), JWT (emisor, audiencia, 60 min), roles, bloqueo de login (5 fallos → 15 min), CORS cerrado por defecto, salida HTML escapada en el panel.
- Auditoría append-only con hash SHA-256 encadenado.
- Retención: `RetentionWorker` purga embeddings vencidos según `DIAS_RETENCION_BIOMETRICA`.
- Frontend modular (WebRTC + Canvas), panel admin con login, métricas y exportación CSV con autenticación.
- 11 pruebas automatizadas end-to-end (ver [PLAN_DE_PRUEBAS.md](PLAN_DE_PRUEBAS.md)).

## 2. Limitaciones conocidas (leer antes de presentar)
| Área | Situación real | Para producción |
|------|----------------|-----------------|
| **Comparación facial** | `ImageCorrelationEmbeddingProvider` correlaciona imágenes en gris 32×32. Reconoce que dos imágenes son la misma, **no identifica personas**. Una selfie vs. foto de DUI normalmente dará similitud baja. | Implementar `IFaceEmbeddingProvider` con un modelo ONNX (ArcFace/FaceNet) o servicio externo. Es un único punto de cambio (`Program.cs`). |
| **Liveness** | Heurísticas simples en el cliente (diferencia entre frames, luminosidad). Los umbrales **no están calibrados** con cámaras reales. El ruido del sensor puede impedir detectar una foto estática. No detecta pantallas ni máscaras 3D. La telemetría la envía el cliente, por lo que un atacante con control del navegador puede falsificarla. | Modelo de liveness/PAD en servidor (p. ej. MediaPipe/ONNX), retos con desafío criptográfico y validación de frames en el servidor. |
| **Retos sonrisa / lectura de código** | Solo verifican que haya movimiento; no reconocen la sonrisa ni la lectura. | Detector de landmarks faciales. |
| **OCR de documentos** | No implementado (se declara `ocrDisponible: false`). Solo valida formato de DUI, tamaño y que sea imagen. | Tesseract / servicio OCR. |
| **MFA del panel admin** | No implementado (los campos existen en el modelo). | TOTP (RFC 6238). |
| **Refresh token** | No implementado; el JWT dura 60 min. | Endpoint de refresh con rotación. |
| **Cifrado en reposo (AES-256)** | No implementado; SQLite sin cifrar. TLS depende de cómo se despliegue. | SQLCipher o cifrado de BD/volumen; HTTPS con certificado. |
| **Reportes** | CSV (sin escapado de comas en nombres) — sin PDF/Excel. | Librería de reportes. |
| **Notificaciones** | Solo registran en el log; sin correo real. | SMTP/SendGrid. |
| **Escalabilidad** | Instancia única, SQLite, bloqueo de login en memoria. | PostgreSQL/SQL Server, colas y workers, Redis. |
| **Roles de usuario** | No hay registro/gestión de usuarios desde la UI; solo listado. | CRUD de usuarios con permisos. |
| **Credenciales semilla** | `Admin@2026!` solo para desarrollo (configurable con `LIVENESS_SEED_ADMIN_PASSWORD`). | Cambiar siempre al desplegar. |
| **Clave JWT** | Valor de ejemplo en `appsettings.json`. | Definir `Jwt__Key` por variable de entorno. |

## 3. Roadmap propuesto
| Sprint | Duración | Objetivo | Estado |
|--------|----------|----------|--------|
| 1 | 2 sem | Requisitos, modelo de datos, API base, auditoría | Hecho |
| 2 | 2 sem | Frontend WebRTC/Canvas, retos, panel admin con login | Hecho (falta validación manual con cámara) |
| 3 | 2 sem | Proveedor facial real (ONNX), calibración de liveness con datos reales, pruebas xUnit | Pendiente |
| 4 | 2 sem | MFA, refresh token, PostgreSQL, OCR, reportes PDF/Excel, notificaciones por correo | Pendiente |
| 5 | 1 sem | Pruebas de carga, endurecimiento, informe final con métricas medidas | Pendiente |

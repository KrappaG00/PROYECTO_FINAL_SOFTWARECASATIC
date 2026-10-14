# Sistema de Pruebas de Vida (Liveness Detection) y Verificación de Identidad
**Proyecto "Proyect05" — Grupo 4 | CASATIC / UGB**

Aplicación web que guía a un usuario por: datos + consentimiento → foto de documento (DUI/pasaporte) → retos aleatorios frente a la cámara → comparación con el documento → dictamen (aprobado / rechazado / revisión manual) con auditoría inmutable.

> [!IMPORTANT]
> Es un **prototipo funcional académico**. La comparación facial es una correlación de imágenes (no reconoce personas) y las heurísticas de liveness no están calibradas con cámaras reales. Lee [docs/ESTADO_Y_LIMITACIONES.md](docs/ESTADO_Y_LIMITACIONES.md) antes de presentar o usar en un entorno real.

## Estructura
```text
.gitignore
README.md
vercel.json                    # Configuración para Vercel con permisos de cámara
package.json                   # Manifiesto web estático
index.html                     # Página web principal
css/ & js/                     # Estilos, WebRTC, Canvas y motor biométrico
database/schema.sql            # Esquema de base de datos
docs/                          # Requisitos, arquitectura, guía Vercel, pruebas
tests/smoke.ps1                # Pruebas de integración
src/                           # Código fuente (frontend y backend C# opcional)
```

## Requisitos
- .NET SDK 8.0 o superior (`dotnet --version`)
- Navegador moderno con cámara (Chrome, Edge, Firefox). La cámara solo funciona en `http://localhost` o HTTPS.

## Ejecutar
```powershell
cd src/backend/LivenessApi
dotnet run --urls http://localhost:5080
```
- Aplicación: <http://localhost:5080>
- Swagger: <http://localhost:5080/swagger>

El backend sirve directamente la carpeta `src/frontend`. La base SQLite (`liveness_verification.db`) se crea sola en el primer arranque; para reiniciarla, detén la app y borra ese archivo.

## Probar
Con la API en marcha, en otra terminal desde la raíz del repo:
```powershell
powershell -ExecutionPolicy Bypass -File tests/smoke.ps1 -Base http://localhost:5080
```
Ejecuta 11 comprobaciones (flujo aprobado, rechazo, fraude, permisos, login, auditoría). Las pruebas con cámara real son manuales: ver [docs/PLAN_DE_PRUEBAS.md](docs/PLAN_DE_PRUEBAS.md).

### Probar el flujo completo en el navegador
Como la comparación facial es una correlación de imágenes, para ver una **aprobación** sube como documento una imagen y, durante la prueba, ten en cámara esa misma imagen (por ejemplo en pantalla)… lo que a su vez puede activar alertas de pantalla/estática. Para demostrar el camino de aprobación de forma fiable usa `tests/smoke.ps1`; para el navegador, espera ver principalmente rechazos o zona gris hasta integrar un modelo facial real.

## Acceso administrativo
Barra superior de la página → correo y contraseña. Usuarios de desarrollo creados al primer arranque:

| Rol | Correo | Contraseña |
|-----|--------|------------|
| Administrador | admin@ugb.edu.sv | `Admin@2026!` |
| Oficial de verificación | oficial@ugb.edu.sv | `Admin@2026!` |

Cambia la contraseña inicial antes de la primera ejecución con `LIVENESS_SEED_ADMIN_PASSWORD`, y define la clave JWT con la variable de entorno `Jwt__Key` (mínimo 32 caracteres) en cualquier despliegue.

## Configuración
`src/backend/LivenessApi/appsettings.json`: cadena de conexión, JWT (`Jwt:Key|Issuer|Audience`), `Cors:Origins` (vacío = solo mismo origen), `Swagger:Enabled`. Los umbrales biométricos y la retención se cambian en la tabla `ConfiguracionSistema` (`POST /api/admin/config`, solo Administrador).

## Endpoints
| Método | Ruta | Acceso |
|--------|------|--------|
| POST | `/api/auth/login` | Público |
| POST | `/api/verification/create` | Público |
| POST | `/api/verification/upload-document` | Público |
| GET | `/api/liveness/challenges/{codigo}` | Público |
| POST | `/api/verification/submit-attempt` | Público |
| GET | `/api/verification/{codigo}` | Público (código no adivinable) |
| POST | `/api/verification/manual-review` | Administrador / Oficial |
| GET | `/api/admin/verifications`, `/api/admin/users`, `/api/admin/config` | Administrador / Oficial |
| POST | `/api/admin/config` | Administrador |
| GET | `/api/reports/metrics`, `/api/reports/audit-logs`, `/api/reports/export/csv` | Administrador / Oficial |
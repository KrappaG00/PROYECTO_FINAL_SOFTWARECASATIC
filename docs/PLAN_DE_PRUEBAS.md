# Plan de Pruebas e Informe de Resultados
**Proyecto:** Proyect05 - Grupo 4 | CASATIC / UGB

## 1. Objetivos
1. Validar el flujo completo: solicitud → documento → retos → liveness → comparación → dictamen → auditoría.
2. Verificar reglas de negocio (3 intentos, estados finales, consentimiento, zona gris, rechazo por fraude).
3. Verificar seguridad básica (JWT, roles, bloqueo de login, hash de contraseñas, auditoría encadenada).
4. Definir pruebas manuales con cámara real que **no** se pueden automatizar.

## 2. Pruebas automatizadas — EJECUTADAS
Script: [`tests/smoke.ps1`](../tests/smoke.ps1). Se ejecuta contra la API levantada:

```powershell
cd src/backend/LivenessApi
dotnet run --urls http://localhost:5080
# en otra terminal, desde la raíz del repo:
powershell -ExecutionPolicy Bypass -File tests/smoke.ps1 -Base http://localhost:5080
```

Resultado de la última ejecución (11/11 correctas, 0 fallos):

| # | Caso | Resultado esperado | Resultado |
|---|------|--------------------|-----------|
| 1 | Generación de retos | 2 a 3 retos por solicitud | OK (3 retos) |
| 2 | Misma imagen en documento y captura, retos cumplidos | `APROBADO` | OK (similitud 1.0) |
| 3 | Imagen distinta en documento y captura | No aprobado | OK (similitud 0, `EN_PROCESO`, quedan intentos) |
| 4 | Telemetría de imagen estática | `RECHAZADO` por fraude | OK |
| 5 | Solicitud sin consentimiento | HTTP 400 | OK |
| 6 | Endpoint admin sin token | HTTP 401 | OK |
| 7 | Login con contraseña incorrecta | HTTP 401 | OK |
| 8 | Login válido | JWT con rol | OK (`Administrador`) |
| 9 | Métricas con token | Datos reales de BD | OK |
| 10 | Logs de auditoría | Hash SHA-256 de 64 caracteres | OK |
| 11 | Frontend servido en `/` | HTTP 200 | OK |

> [!WARNING]
> Estas pruebas validan la **lógica del backend y las reglas de negocio**. No validan precisión biométrica real: ver sección 4.

## 3. Pruebas manuales con cámara — PENDIENTES (no ejecutadas)
No se pudieron ejecutar en el entorno de desarrollo (sin cámara/navegador). Deben realizarlas los integrantes y registrar los resultados en la columna final.

| ID | Prueba | Procedimiento | Criterio | Resultado |
|----|--------|---------------|----------|-----------|
| M-01 | Permisos de cámara | Denegar permiso en el navegador | Mensaje claro en español | _pendiente_ |
| M-02 | Iluminación | Tapar la cámara / contraluz | Indicador de luz en alerta | _pendiente_ |
| M-03 | Parpadeo doble | Parpadear 2 veces | Reto cumplido antes del timeout | _pendiente_ |
| M-04 | Giro de cabeza | Girar a ambos lados | Reto cumplido | _pendiente_ |
| M-05 | Foto impresa | Mostrar foto a la cámara | Alerta de imagen estática / rechazo | _pendiente_ |
| M-06 | Pantalla con video | Mostrar video en celular | Observar comportamiento (ver limitaciones) | _pendiente_ |
| M-07 | Tiempo total | Cronometrar prueba completa | < 60 s | _pendiente_ |
| M-08 | Navegadores | Chrome, Edge, Firefox | Flujo completo funcional | _pendiente_ |

## 4. Precisión biométrica — NO MEDIDA
No se calcularon FAR, FRR ni EER: para ello se necesita un conjunto de datos etiquetado y un modelo de reconocimiento facial real (ver [ESTADO_Y_LIMITACIONES.md](ESTADO_Y_LIMITACIONES.md)). Cualquier cifra de precisión debe obtenerse con pruebas propias antes de citarla en el informe.

## 5. Pruebas recomendadas a futuro
- Proyecto `xUnit` para `LivenessService`, `FaceComparisonService` y `PasswordHasher`.
- Pruebas de carga (verificaciones simultáneas) con k6 o similar.
- Verificación de integridad de la cadena de auditoría (recalcular hashes).

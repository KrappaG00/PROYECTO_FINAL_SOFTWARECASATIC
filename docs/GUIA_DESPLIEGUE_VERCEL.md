# Guía de Despliegue en Vercel en 1 Minuto
## Sistema de Pruebas de Vida (Liveness Detection) - Grupo 4 | CASATIC / UGB

Este proyecto ha sido optimizado para funcionar como una **aplicación web moderna e interactiva** lista para desplegarse en **Vercel** con **cero configuración de servidores**.

---

### ¿Por qué Vercel es ideal para este proyecto?
1. **HTTPS automático y gratuito:** Los navegadores modernos (Chrome, Safari, Edge) **bloquean el acceso a la cámara web (`getUserMedia`)** en cualquier sitio web que no tenga HTTPS. Vercel le asigna un certificado SSL automáticamente (`https://tu-proyecto.vercel.app`).
2. **Cero configuración:** El repositorio incluye `vercel.json` y los archivos estáticos en la raíz (`index.html`, `css/`, `js/`), por lo que Vercel lo detecta y publica al instante.
3. **Motor biométrico autónomo en cliente:** La aplicación procesa la captura de cámara, la detección de micro-movimientos, los retos (parpadeo, giros de cabeza, sonrisa), la comparación facial de vectores Coseno y el registro inmutable de auditoría con SHA-256 directamente en el navegador.

---

### Opción 1: Despliegue mediante GitHub (Recomendado)

1. Sube tu código a tu repositorio de **GitHub** (siguiendo los pasos de `docs/GUIA_GITHUB_MANUAL.md`).
2. Entra a [https://vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
3. En el panel principal de Vercel, haz clic en **"Add New..."** → **"Project"**.
4. Selecciona tu repositorio de la lista y haz clic en **"Import"**.
5. Deja todas las opciones predeterminadas (Framework Preset: *Other*, Root Directory: `./`).
6. Haz clic en el botón azul **"Deploy"**.
7. En menos de 30 segundos tu proyecto estará en línea con una URL pública:  
   `https://sistema-pruebas-vida-liveness.vercel.app`

---

### Opción 2: Despliegue arrastrando la carpeta (Vercel CLI / Drag & Drop)

Si tienes instalada la herramienta oficial de Vercel en tu terminal:
```bash
npx vercel
```
O simplemente:
1. Instala Vercel CLI si lo deseas: `npm i -g vercel`
2. Ejecuta `vercel --prod` en esta carpeta.

---

### Cómo probar la aplicación desplegada en Vercel

1. **Abre el enlace en tu celular o computadora:**
   - La URL tendrá `https://` automático.
   - El navegador te pedirá permiso para encender la cámara web. Presiona **"Permitir"**.
2. **Realizar una Verificación:**
   - En la pestaña **Verificación**, escribe tu nombre y número de documento (DUI).
   - Adjunta una fotografía de tu documento.
   - Presiona **"Continuar a Verificación"**.
   - Sigue los retos aleatorios en pantalla (parpadear, girar la cabeza, sonreír).
   - El sistema evaluará tu presencia y te mostrará el resultado con el dictamen y los porcentajes de similitud y viveza.
3. **Ingresar al Panel de Administración:**
   - En la barra superior oscura, ingresa las credenciales:
     - **Correo:** `admin@ugb.edu.sv`
     - **Contraseña:** `Admin@2026!`
   - Haz clic en **"Entrar"**.
   - Ahora podrás ver los registros en **Historial**, métricas ejecutivas en **Reportes** y descargar el archivo **CSV** auditable con un solo clic.

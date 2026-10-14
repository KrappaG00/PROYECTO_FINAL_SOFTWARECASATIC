# Guía de Subida Manual y Organización del Repositorio en GitHub
## Sistema de Pruebas de Vida (Liveness Detection) - Grupo 4 | CASATIC / UGB

Esta guía proporciona las instrucciones paso a paso para que los integrantes del **Grupo 4** suban manualmente este proyecto a **GitHub** o **GitLab**, respetando las buenas prácticas de desarrollo de software, sin incluir archivos temporales o binarios compilados.

---

### 1. Estructura Exacta del Repositorio a Subir
Verifica que en tu repositorio la raíz contenga únicamente la siguiente estructura limpia:

```text
PROYECTO FINAL / (o nombre de tu repositorio en GitHub: LivenessDetection-Grupo4)
│
├── .gitignore                     <-- Archivo para ignorar binarios y temporales
├── README.md                      <-- Manual maestro de instalación y ejecución
│
├── database/                      <-- Scripts de base de datos
│   └── schema.sql                 <-- Script DDL de tablas, índices y datos iniciales
│
├── docs/                          <-- Documentación técnica completa
│   ├── ESPECIFICACION_REQUISITOS.md
│   ├── ARQUITECTURA_SISTEMA.md
│   ├── MODELO_DATOS.md
│   ├── PLAN_DE_PRUEBAS.md
│   └── GUIA_GITHUB_MANUAL.md
│
├── tests/                         <-- smoke.ps1 (pruebas end-to-end)
│
└── src/                           <-- Código fuente del proyecto
    ├── frontend/                  <-- Aplicación cliente Web
    │   ├── index.html             <-- Interfaz de usuario completa con tabs y modales
    │   ├── css/
    │   │   └── styles.css         <-- Estilos, overlay facial y diseño responsivo
    │   └── js/
    │       ├── api.js             <-- Cliente de comunicación HTTP con la API REST
    │       ├── camera.js          <-- Manejador de WebRTC y captura a Canvas
    │       ├── liveness.js        <-- Motor heurístico de visión por computadora
    │       ├── ui.js              <-- Gestor de estados de la interfaz y notificaciones
    │       └── app.js             <-- Controlador orquestador principal
    │
    └── backend/                   <-- Solución Backend en C# / ASP.NET Core
        ├── LivenessApi.sln        <-- Solución de Visual Studio / .NET CLI
        └── LivenessApi/
            ├── LivenessApi.csproj <-- Archivo de proyecto .NET 8 con dependencias
            ├── Program.cs         <-- Configuración de middleware, Swagger y servicios
            ├── appsettings.json   <-- Configuración de conexión y parámetros biométricos
            ├── Controllers/       <-- Endpoints REST (Auth, Verification, Liveness, Admin, Reports)
            ├── Services/          <-- Lógica de negocio (Liveness, FaceComparison, Document, Audit)
            ├── Models/            <-- Entidades de dominio (Usuario, Solicitud, Intento, Reto, etc.)
            ├── DTOs/              <-- Objetos de transferencia de datos
            ├── Data/              <-- Contexto de Entity Framework Core y semillas
            └── wwwroot/           <-- Solo .gitkeep (el backend sirve src/frontend)
```

---

### 2. Pasos para Crear el Repositorio en GitHub (Vía Web)

1. **Iniciar Sesión:** Ingresa a [https://github.com](https://github.com) con la cuenta de uno de los integrantes del Grupo 4.
2. **Crear Nuevo Repositorio:**
   - Haz clic en el botón verde **"New"** (Nuevo repositorio).
   - **Repository name:** `sistema-pruebas-vida-liveness` (o el nombre acordado).
   - **Description:** `Sistema de Pruebas de Vida (Liveness Detection) y Verificación de Identidad - Proyect05 Grupo 4 (CASATIC / UGB)`.
   - **Visibilidad:** Selecciona **Public** (Público) o **Private** (Privado con colaboradores invitados).
   - **Opciones de inicialización:** **NO** marques "Add a README file", **NO** marques "Add .gitignore" (ya los tienes generados y listos en esta carpeta).
   - Haz clic en **"Create repository"**.

---

### 3. Métodos para Subir los Archivos Manualmente

#### Opción A: Subida Manual Directa desde el Navegador Web (Sin instalar Git)
1. En la página principal del repositorio recién creado en GitHub, haz clic en el enlace **"uploading an existing file"** (subir un archivo existente).
2. Arrastra o selecciona las carpetas `database`, `docs`, `src` y los archivos `README.md` y `.gitignore`.
3. En el campo de commit inferior, escribe:
   - Título: `Entrega inicial: Sistema de Pruebas de Vida y Verificación de Identidad (Proyect05 Grupo 4)`
   - Descripción: `Incluye backend C# ASP.NET Core, frontend modular Vanilla JS/Canvas/WebRTC, scripts SQL y documentación.`
4. Presiona el botón verde **"Commit changes"**.

#### Opción B: Subida mediante Git en tu Computadora (Manual por el usuario)
Si tienes Git instalado en tu máquina y prefieres usar la terminal, ejecuta manualmente en esta carpeta:
```bash
git init
git add .
git commit -m "Entrega inicial: Sistema de Pruebas de Vida (Proyect05 Grupo 4)"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

---

### 4. Qué Archivos NUNCA Debes Subir a GitHub
Gracias al archivo `.gitignore` configurado, los siguientes archivos se excluyen automáticamente:
- Carpetas `bin/` y `obj/` (se generan solas al compilar).
- Archivos `.db`, `.db-shm`, `.db-wal` de bases de datos locales temporales.
- Carpetas ocultas `.vs/` o configuraciones privadas de usuario.
- Claves privadas o certificados `.pfx` / `.key`.

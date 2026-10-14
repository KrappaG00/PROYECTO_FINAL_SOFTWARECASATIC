using System.Security.Cryptography;
using System.Text;
using LivenessApi.Models;
using Microsoft.EntityFrameworkCore;

namespace LivenessApi.Data;

public static class DbInitializer
{
    public static void Initialize(ApplicationDbContext context)
    {
        context.Database.EnsureCreated();

        if (!context.Roles.Any())
        {
            var roles = new[]
            {
                new Rol { Id = 1, Nombre = "Administrador", Descripcion = "Control total y auditoría" },
                new Rol { Id = 2, Nombre = "OficialVerificacion", Descripcion = "Revisión manual y reportes" },
                new Rol { Id = 3, Nombre = "UsuarioCliente", Descripcion = "Usuario final solicitante" }
            };
            context.Roles.AddRange(roles);
            context.SaveChanges();
        }

        if (!context.RetosLiveness.Any())
        {
            var retos = new[]
            {
                new RetoLiveness { Id = 1, CodigoReto = "PARPADEO_DOBLE", NombreReto = "Parpadeo doble", InstruccionUsuario = "Parpadea lentamente dos veces mirando a la cámara", TiempoLimiteSegundos = 12, IconoClave = "blink" },
                new RetoLiveness { Id = 2, CodigoReto = "GIRO_DERECHA", NombreReto = "Giro a la derecha", InstruccionUsuario = "Gira suavemente la cabeza hacia tu derecha y regresa al centro", TiempoLimiteSegundos = 12, IconoClave = "arrow-right" },
                new RetoLiveness { Id = 3, CodigoReto = "GIRO_IZQUIERDA", NombreReto = "Giro a la izquierda", InstruccionUsuario = "Gira suavemente la cabeza hacia tu izquierda y regresa al centro", TiempoLimiteSegundos = 12, IconoClave = "arrow-left" },
                new RetoLiveness { Id = 4, CodigoReto = "SONREIR", NombreReto = "Sonrisa natural", InstruccionUsuario = "Sonríe naturalmente a la cámara y mantén 2 segundos", TiempoLimiteSegundos = 10, IconoClave = "smile" },
                new RetoLiveness { Id = 5, CodigoReto = "LECTURA_CODIGO", NombreReto = "Lectura de código", InstruccionUsuario = "Asiente o lee en voz alta el código de seguridad", TiempoLimiteSegundos = 15, IconoClave = "code" }
            };
            context.RetosLiveness.AddRange(retos);
            context.SaveChanges();
        }

        if (!context.ConfiguracionSistema.Any())
        {
            var configs = new[]
            {
                new ConfiguracionSistema { Clave = "UMBRAL_SIMILITUD_MINIMA", Valor = "0.75", Descripcion = "Umbral de similitud para aprobación automática" },
                new ConfiguracionSistema { Clave = "UMBRAL_REVISION_MANUAL", Valor = "0.60", Descripcion = "Umbral inferior para pasar a revisión manual" },
                new ConfiguracionSistema { Clave = "UMBRAL_LIVENESS_MINIMO", Valor = "0.70", Descripcion = "Score mínimo requerido en prueba de vida" },
                new ConfiguracionSistema { Clave = "MAX_INTENTOS_POR_SOLICITUD", Valor = "3", Descripcion = "Máximo de intentos por solicitud" },
                new ConfiguracionSistema { Clave = "DIAS_RETENCION_BIOMETRICA", Valor = "30", Descripcion = "Días de retención de datos según política GDPR" },
                new ConfiguracionSistema { Clave = "MFA_OBLIGATORIO_ADMIN", Valor = "true", Descripcion = "MFA para administradores" }
            };
            context.ConfiguracionSistema.AddRange(configs);
            context.SaveChanges();
        }

        if (!context.Usuarios.Any())
        {
            // Contraseña inicial solo para desarrollo; cámbiala en cualquier despliegue real.
            string passwordHash = LivenessApi.Services.PasswordHasher.Hash(
                Environment.GetEnvironmentVariable("LIVENESS_SEED_ADMIN_PASSWORD") ?? "Admin@2026!");
            var usuarios = new[]
            {
                new Usuario
                {
                    RolId = 1,
                    NombreCompleto = "Administrador del Sistema Grupo 4",
                    Email = "admin@ugb.edu.sv",
                    PasswordHash = passwordHash,
                    MfaHabilitado = false,
                    Activo = true
                },
                new Usuario
                {
                    RolId = 2,
                    NombreCompleto = "Oficial de Verificación CASATIC",
                    Email = "oficial@ugb.edu.sv",
                    PasswordHash = passwordHash,
                    MfaHabilitado = false,
                    Activo = true
                }
            };
            context.Usuarios.AddRange(usuarios);
            context.SaveChanges();
        }
    }

    public static string ComputeSha256(string rawData)
    {
        using SHA256 sha256Hash = SHA256.Create();
        byte[] bytes = sha256Hash.ComputeHash(Encoding.UTF8.GetBytes(rawData));
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < bytes.Length; i++)
        {
            builder.Append(bytes[i].ToString("x2"));
        }
        return builder.ToString();
    }
}

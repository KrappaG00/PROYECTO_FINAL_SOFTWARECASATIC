using System.Security.Cryptography;
using System.Text;
using LivenessApi.Data;
using LivenessApi.Models;
using Microsoft.EntityFrameworkCore;

namespace LivenessApi.Services;

public class AuditService : IAuditService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<AuditService> _logger;

    public AuditService(ApplicationDbContext context, ILogger<AuditService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task RegistrarEventoAsync(int? solicitudId, int? usuarioId, string evento, string severidad, string detalle, string? ip = null, string? userAgent = null)
    {
        try
        {
            // Obtener el último hash para encadenar (blockchain-style tamper proofing)
            var ultimoLog = await _context.LogsAuditoria
                .OrderByDescending(l => l.Id)
                .Select(l => l.HashIntegridad)
                .FirstOrDefaultAsync();

            string prevHash = ultimoLog ?? "GENESIS_GRUPO4_LIVENESS";
            string rawIntegrity = $"{prevHash}|{solicitudId}|{usuarioId}|{evento}|{detalle}|{DateTime.UtcNow:O}";
            string currentHash = ComputeSha256(rawIntegrity);

            var log = new LogAuditoria
            {
                SolicitudId = solicitudId,
                UsuarioId = usuarioId,
                Evento = evento,
                NivelSeveridad = severidad,
                Detalle = detalle,
                HashIntegridad = currentHash,
                DireccionIP = ip,
                UserAgent = userAgent,
                FechaRegistro = DateTime.UtcNow
            };

            _context.LogsAuditoria.Add(log);
            await _context.SaveChangesAsync();

            _logger.LogInformation("[AUDITORIA-{Severidad}] {Evento}: {Detalle}", severidad, evento, detalle);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al registrar evento inmutable de auditoría");
        }
    }

    public async Task<List<LogAuditoria>> ObtenerLogsAsync(int limite = 100)
    {
        return await _context.LogsAuditoria
            .OrderByDescending(l => l.FechaRegistro)
            .Take(limite)
            .ToListAsync();
    }

    private static string ComputeSha256(string rawData)
    {
        using SHA256 sha256Hash = SHA256.Create();
        byte[] bytes = sha256Hash.ComputeHash(Encoding.UTF8.GetBytes(rawData));
        StringBuilder builder = new StringBuilder();
        foreach (byte b in bytes)
        {
            builder.Append(b.ToString("x2"));
        }
        return builder.ToString();
    }
}

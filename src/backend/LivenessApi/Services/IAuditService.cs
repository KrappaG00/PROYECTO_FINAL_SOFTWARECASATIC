using LivenessApi.Models;

namespace LivenessApi.Services;

public interface IAuditService
{
    Task RegistrarEventoAsync(int? solicitudId, int? usuarioId, string evento, string severidad, string detalle, string? ip = null, string? userAgent = null);
    Task<List<LogAuditoria>> ObtenerLogsAsync(int limite = 100);
}

namespace LivenessApi.Models;

public class LogAuditoria
{
    public int Id { get; set; }
    public int? SolicitudId { get; set; }
    public int? UsuarioId { get; set; }
    public string Evento { get; set; } = string.Empty;
    public string NivelSeveridad { get; set; } = "INFO";
    public string Detalle { get; set; } = string.Empty;
    public string HashIntegridad { get; set; } = string.Empty; // SHA-256 encadenado
    public string? DireccionIP { get; set; }
    public string? UserAgent { get; set; }
    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;
}

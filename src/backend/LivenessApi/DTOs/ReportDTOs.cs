namespace LivenessApi.DTOs;

public class SystemMetricsDto
{
    public int TotalSolicitudes { get; set; }
    public int SolicitudesAprobadas { get; set; }
    public int SolicitudesRechazadas { get; set; }
    public int SolicitudesRevisionManual { get; set; }
    public int IntentosBloqueados { get; set; }
    public double TasaExitoPorcentaje { get; set; }
    public double TasaFraudePorcentaje { get; set; }
    public double TiempoPromedioVerificacionSegundos { get; set; }
    public double ScoreLivenessPromedio { get; set; }
    public double ScoreSimilitudPromedio { get; set; }
}

public class AuditLogDto
{
    public int Id { get; set; }
    public int? SolicitudId { get; set; }
    public string Evento { get; set; } = string.Empty;
    public string NivelSeveridad { get; set; } = "INFO";
    public string Detalle { get; set; } = string.Empty;
    public string HashIntegridad { get; set; } = string.Empty;
    public string? DireccionIP { get; set; }
    public DateTime FechaRegistro { get; set; }
}

public class VerificationSummaryItemDto
{
    public int Id { get; set; }
    public string CodigoSolicitud { get; set; } = string.Empty;
    public string NombrePersona { get; set; } = string.Empty;
    public string NumeroDocumento { get; set; } = string.Empty;
    public string TipoDocumento { get; set; } = "DUI";
    public string Estado { get; set; } = "PENDIENTE";
    public double ScoreSimilitudFacial { get; set; }
    public double ScoreLivenessGlobal { get; set; }
    public int IntentosRestantes { get; set; }
    public DateTime FechaCreacion { get; set; }
}

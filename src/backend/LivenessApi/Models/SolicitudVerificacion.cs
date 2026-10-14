namespace LivenessApi.Models;

public class SolicitudVerificacion
{
    public int Id { get; set; }
    public string CodigoSolicitud { get; set; } = Guid.NewGuid().ToString("N");
    public int? UsuarioSolicitanteId { get; set; }
    public string NombrePersona { get; set; } = string.Empty;
    public string NumeroDocumento { get; set; } = string.Empty;
    public string TipoDocumento { get; set; } = "DUI"; // DUI, PASAPORTE, LICENCIA
    public string Estado { get; set; } = "PENDIENTE"; // PENDIENTE, EN_PROCESO, APROBADO, RECHAZADO, REVISION_MANUAL, BLOQUEADO
    public int IntentosRestantes { get; set; } = 3;
    public bool ConsentimientoAceptado { get; set; } = true;
    public DateTime FechaConsentimiento { get; set; } = DateTime.UtcNow;
    public double ScoreSimilitudFacial { get; set; } = 0.0;
    public double ScoreLivenessGlobal { get; set; } = 0.0;
    public string? Observaciones { get; set; }
    public int? RevisadoPorUsuarioId { get; set; }
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    public DateTime? FechaFinalizacion { get; set; }

    public Usuario? UsuarioSolicitante { get; set; }
    public Usuario? RevisadoPorUsuario { get; set; }
    public DocumentoIdentidad? Documento { get; set; }
    public ICollection<IntentoVerificacion> Intentos { get; set; } = new List<IntentoVerificacion>();
}

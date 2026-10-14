namespace LivenessApi.DTOs;

public class CreateVerificationRequest
{
    public string NombrePersona { get; set; } = string.Empty;
    public string NumeroDocumento { get; set; } = string.Empty;
    public string TipoDocumento { get; set; } = "DUI";
    public bool AceptaConsentimiento { get; set; } = true;
}

public class DocumentUploadRequest
{
    public string CodigoSolicitud { get; set; } = string.Empty;
    public string ImagenDocumentoBase64 { get; set; } = string.Empty; // data:image/jpeg;base64,...
    public string TipoDocumento { get; set; } = "DUI";
    public string NumeroDocumento { get; set; } = string.Empty;
}

public class SubmitVerificationAttemptRequest
{
    public string CodigoSolicitud { get; set; } = string.Empty;
    public string RostroCapturadoBase64 { get; set; } = string.Empty;
    public List<ChallengeResponseItem> RespuestasRetos { get; set; } = new();
    public double ScoreLivenessFrontend { get; set; } = 0.0;
    /// <summary>Movimiento inter-frame medio observado en el cliente (0-1).</summary>
    public double MovimientoPromedio { get; set; } = 0.0;
    /// <summary>True si el cliente observó imagen estática sostenida durante la prueba.</summary>
    public bool EstaticoDetectado { get; set; } = false;
    public double DuracionSegundos { get; set; } = 0.0;
    public string? DispositivoUserAgent { get; set; }
}

public class ChallengeResponseItem
{
    public int RetoId { get; set; }
    public string CodigoReto { get; set; } = string.Empty;
    public bool Cumplido { get; set; }
    public double ScoreCumplimiento { get; set; }
}

public class VerificationResultDto
{
    public string CodigoSolicitud { get; set; } = string.Empty;
    public string Estado { get; set; } = "PENDIENTE"; // APROBADO, RECHAZADO, REVISION_MANUAL, BLOQUEADO
    public double ScoreLiveness { get; set; }
    public double ScoreSimilitudFacial { get; set; }
    public int IntentosRestantes { get; set; }
    public string Mensaje { get; set; } = string.Empty;
    public bool EsSospechaFraude { get; set; }
    public string? TipoFraudeDetectado { get; set; }
    public DateTime FechaProcesamiento { get; set; } = DateTime.UtcNow;
}

public class ManualReviewDecisionDto
{
    public string CodigoSolicitud { get; set; } = string.Empty;
    public string Decision { get; set; } = "APROBADO"; // APROBADO, RECHAZADO
    public string Observaciones { get; set; } = string.Empty;
}

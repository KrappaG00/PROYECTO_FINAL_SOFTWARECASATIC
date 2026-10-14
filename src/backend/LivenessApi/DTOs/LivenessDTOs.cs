namespace LivenessApi.DTOs;

public class LivenessChallengeResponse
{
    public string CodigoSolicitud { get; set; } = string.Empty;
    public string SesionToken { get; set; } = Guid.NewGuid().ToString("N");
    public List<ChallengeItemDto> RetosAsignados { get; set; } = new();
    public int TiempoTotalLimiteSegundos { get; set; } = 45;
    public string CodigoSeguridadLectura { get; set; } = string.Empty;
}

public class ChallengeItemDto
{
    public int Id { get; set; }
    public string CodigoReto { get; set; } = string.Empty;
    public string NombreReto { get; set; } = string.Empty;
    public string Instruccion { get; set; } = string.Empty;
    public int TiempoSegundos { get; set; }
    public string Icono { get; set; } = "eye";
}

public class FrameAnalysisRequest
{
    public string CodigoSolicitud { get; set; } = string.Empty;
    public string FrameBase64 { get; set; } = string.Empty;
    public string RetoActualCodigo { get; set; } = string.Empty;
    public int FrameIndex { get; set; }
}

public class FrameAnalysisResult
{
    public bool RostroDetectado { get; set; }
    public bool IluminacionAdecuada { get; set; }
    public double NivelNitidez { get; set; }
    public bool RetoCumplido { get; set; }
    public string FeedbackVisual { get; set; } = "Rostro centrado correctamente";
    public double ConfianzaHeuristica { get; set; }
}

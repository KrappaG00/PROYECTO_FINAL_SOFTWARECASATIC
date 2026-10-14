namespace LivenessApi.Models;

public class IntentoVerificacion
{
    public int Id { get; set; }
    public int SolicitudId { get; set; }
    public int NumeroIntento { get; set; }
    public string? DispositivoUserAgent { get; set; }
    public string? DireccionIP { get; set; }
    public string? SecuenciaRetosAsignada { get; set; } // JSON
    public bool SecuenciaRetosCumplida { get; set; } = false;
    public bool ParpadeoDetectado { get; set; } = false;
    public bool GiroCabezaDetectado { get; set; } = false;
    public bool SonrisaDetectada { get; set; } = false;
    public bool LecturaCodigoDetectada { get; set; } = false;
    public double AnalisisTexturaLaplaciana { get; set; } = 0.0;
    public double AnalisisDiferenciaFotogramas { get; set; } = 0.0;
    public double ScoreLiveness { get; set; } = 0.0;
    public double ScoreSimilitudFacial { get; set; } = 0.0;
    public bool EsSospechaPantalla { get; set; } = false;
    public bool EsSospechaFotoImpresa { get; set; } = false;
    public bool EsSospechaMascara { get; set; } = false;
    public string ResultadoIntento { get; set; } = "FALLIDO"; // EXITOSO, FALLIDO_LIVENESS, FALLIDO_SIMILITUD, TIMEOUT, ANOMALIA
    public double DuracionSegundos { get; set; } = 0.0;
    public DateTime FechaIntento { get; set; } = DateTime.UtcNow;

    public SolicitudVerificacion? Solicitud { get; set; }
}

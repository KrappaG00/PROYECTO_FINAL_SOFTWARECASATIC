namespace LivenessApi.Models;

public class DocumentoIdentidad
{
    public int Id { get; set; }
    public int SolicitudId { get; set; }
    public string TipoDocumento { get; set; } = "DUI";
    public string NumeroDocumento { get; set; } = string.Empty;
    public string? NombreTitular { get; set; }
    public string? FechaNacimiento { get; set; }
    public string? FechaExpiracion { get; set; }
    public string RutaArchivoHash { get; set; } = string.Empty;
    public string? RostroDocumentoBase64 { get; set; }
    public string? EmbeddingDocumento { get; set; } // JSON array con embedding
    public string? OcrDatosExtraidos { get; set; }
    public bool FormatoValido { get; set; } = true;
    public bool DimensionesValidas { get; set; } = true;
    public DateTime FechaCarga { get; set; } = DateTime.UtcNow;

    public SolicitudVerificacion? Solicitud { get; set; }
}

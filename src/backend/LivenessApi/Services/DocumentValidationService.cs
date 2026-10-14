using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using LivenessApi.DTOs;
using LivenessApi.Models;

namespace LivenessApi.Services;

public class DocumentValidationService : IDocumentValidationService
{
    private static readonly Regex DuiRegex = new(@"^\d{8}-?\d$", RegexOptions.Compiled);
    private readonly IFaceEmbeddingProvider _provider;

    public DocumentValidationService(IFaceEmbeddingProvider provider) => _provider = provider;

    public Task<(bool EsValido, string? Error, DocumentoIdentidad? Documento)> ValidarYProcesarDocumentoAsync(
        SolicitudVerificacion solicitud, DocumentUploadRequest request)
    {
        static Task<(bool, string?, DocumentoIdentidad?)> Fallo(string m) => Task.FromResult<(bool, string?, DocumentoIdentidad?)>((false, m, null));

        var bytes = FaceComparisonService.DecodificarBase64(request.ImagenDocumentoBase64);
        if (bytes == null) return Fallo("La imagen del documento es obligatoria y debe estar en Base64 válido.");
        if (bytes.Length < 10 * 1024) return Fallo("La imagen es demasiado pequeña (mínimo 10 KB).");
        if (bytes.Length > 8 * 1024 * 1024) return Fallo("La imagen excede el máximo de 8 MB.");

        string numDoc = request.NumeroDocumento.Trim();
        if (request.TipoDocumento.Equals("DUI", StringComparison.OrdinalIgnoreCase) && !DuiRegex.IsMatch(numDoc))
            return Fallo("El número de DUI no cumple el formato 00000000-0.");

        // Valida que realmente sea una imagen decodificable y extrae su vector.
        var embedding = _provider.ExtraerEmbedding(bytes);
        if (embedding == null) return Fallo("El archivo no es una imagen válida (JPG/PNG) o carece de contenido.");

        var doc = new DocumentoIdentidad
        {
            SolicitudId = solicitud.Id,
            TipoDocumento = request.TipoDocumento.ToUpperInvariant(),
            NumeroDocumento = numDoc,
            NombreTitular = solicitud.NombrePersona,
            // Privacidad: no se guarda la imagen; solo hash (trazabilidad) y embedding.
            RutaArchivoHash = Convert.ToHexString(SHA256.HashData(bytes)),
            RostroDocumentoBase64 = null,
            EmbeddingDocumento = JsonSerializer.Serialize(embedding),
            // OCR no implementado: se declara explícitamente en lugar de simular datos.
            OcrDatosExtraidos = JsonSerializer.Serialize(new { ocrDisponible = false }),
            FormatoValido = true,
            DimensionesValidas = true,
            FechaCarga = DateTime.UtcNow
        };
        return Task.FromResult<(bool, string?, DocumentoIdentidad?)>((true, null, doc));
    }
}

using System.Text.Json;
using LivenessApi.Data;
using LivenessApi.Models;
using Microsoft.EntityFrameworkCore;

namespace LivenessApi.Services;

public class FaceComparisonService : IFaceComparisonService
{
    private readonly ApplicationDbContext _context;
    private readonly IFaceEmbeddingProvider _provider;

    public FaceComparisonService(ApplicationDbContext context, IFaceEmbeddingProvider provider)
    {
        _context = context;
        _provider = provider;
    }

    public async Task<(double ScoreSimilitud, string Clasificacion, string Detalle)> CompararRostrosAsync(
        string rostroCapturadoBase64,
        DocumentoIdentidad documento)
    {
        // Umbrales configurables (tabla ConfiguracionSistema)
        double umbralAprobado = await LeerUmbral("UMBRAL_SIMILITUD_MINIMA", 0.75);
        double umbralManual = await LeerUmbral("UMBRAL_REVISION_MANUAL", 0.60);

        double[]? embDoc = null;
        if (!string.IsNullOrWhiteSpace(documento.EmbeddingDocumento))
            embDoc = JsonSerializer.Deserialize<double[]>(documento.EmbeddingDocumento);

        byte[]? bytesVivo = DecodificarBase64(rostroCapturadoBase64);
        double[]? embVivo = bytesVivo == null ? null : _provider.ExtraerEmbedding(bytesVivo);

        if (embDoc == null || embVivo == null || embDoc.Length != embVivo.Length)
            return (0.0, "RECHAZADO", "No fue posible extraer características del rostro capturado o del documento.");

        // Coseno entre vectores ya normalizados; se recorta a [0,1].
        double similitud = Math.Clamp(embDoc.Zip(embVivo, (a, b) => a * b).Sum(), 0.0, 1.0);

        if (similitud >= umbralAprobado)
            return (Math.Round(similitud, 4), "APROBADO",
                $"Similitud {similitud:P1} supera el umbral de aprobación ({umbralAprobado:P0}).");
        if (similitud >= umbralManual)
            return (Math.Round(similitud, 4), "REVISION_MANUAL",
                $"Similitud {similitud:P1} en zona gris ({umbralManual:P0}-{umbralAprobado:P0}); requiere revisión humana.");
        return (Math.Round(similitud, 4), "RECHAZADO",
            $"Similitud {similitud:P1} insuficiente (< {umbralManual:P0}).");
    }

    private async Task<double> LeerUmbral(string clave, double porDefecto)
    {
        var c = await _context.ConfiguracionSistema.AsNoTracking().FirstOrDefaultAsync(x => x.Clave == clave);
        return c != null && double.TryParse(c.Valor, System.Globalization.CultureInfo.InvariantCulture, out var v) ? v : porDefecto;
    }

    internal static byte[]? DecodificarBase64(string data)
    {
        if (string.IsNullOrWhiteSpace(data)) return null;
        int coma = data.IndexOf(',');
        if (coma >= 0) data = data[(coma + 1)..];
        try { return Convert.FromBase64String(data); } catch { return null; }
    }
}

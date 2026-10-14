using LivenessApi.Models;

namespace LivenessApi.Services;

public interface IFaceComparisonService
{
    Task<(double ScoreSimilitud, string Clasificacion, string Detalle)> CompararRostrosAsync(
        string rostroCapturadoBase64, 
        DocumentoIdentidad documento);
}

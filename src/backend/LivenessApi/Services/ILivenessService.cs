using LivenessApi.DTOs;
using LivenessApi.Models;

namespace LivenessApi.Services;

public interface ILivenessService
{
    Task<LivenessChallengeResponse> GenerarSecuenciaRetosAsync(string codigoSolicitud);
    Task<FrameAnalysisResult> AnalizarFrameAsync(FrameAnalysisRequest request);
    Task<(bool EsValido, double ScoreLiveness, bool SospechaFraude, string? MotivoFraude)> EvaluarIntentoCompletoAsync(
        SubmitVerificationAttemptRequest request, 
        List<RetoLiveness> catalogoRetos);
}

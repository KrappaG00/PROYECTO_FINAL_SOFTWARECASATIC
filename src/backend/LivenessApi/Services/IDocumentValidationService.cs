using LivenessApi.DTOs;
using LivenessApi.Models;

namespace LivenessApi.Services;

public interface IDocumentValidationService
{
    Task<(bool EsValido, string? Error, DocumentoIdentidad? Documento)> ValidarYProcesarDocumentoAsync(
        SolicitudVerificacion solicitud, 
        DocumentUploadRequest request);
}

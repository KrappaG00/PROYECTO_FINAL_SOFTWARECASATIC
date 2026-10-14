using System.Security.Claims;
using System.Text.Json;
using LivenessApi.Data;
using LivenessApi.DTOs;
using LivenessApi.Models;
using LivenessApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LivenessApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VerificationController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IDocumentValidationService _docService;
    private readonly ILivenessService _livenessService;
    private readonly IFaceComparisonService _faceService;
    private readonly IAuditService _audit;
    private readonly INotificationService _notification;

    public VerificationController(
        ApplicationDbContext context,
        IDocumentValidationService docService,
        ILivenessService livenessService,
        IFaceComparisonService faceService,
        IAuditService audit,
        INotificationService notification)
    {
        _context = context;
        _docService = docService;
        _livenessService = livenessService;
        _faceService = faceService;
        _audit = audit;
        _notification = notification;
    }

    [HttpPost("create")]
    public async Task<IActionResult> CreateVerificationRequest([FromBody] CreateVerificationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NombrePersona) || string.IsNullOrWhiteSpace(request.NumeroDocumento))
        {
            return BadRequest(new { Mensaje = "El nombre y número de documento son obligatorios." });
        }

        if (!request.AceptaConsentimiento)
        {
            return BadRequest(new { Mensaje = "Debe aceptar el consentimiento para el tratamiento de datos biométricos." });
        }

        var nuevaSolicitud = new SolicitudVerificacion
        {
            CodigoSolicitud = Guid.NewGuid().ToString("N")[..12].ToUpper(),
            NombrePersona = request.NombrePersona.Trim(),
            NumeroDocumento = request.NumeroDocumento.Trim(),
            TipoDocumento = request.TipoDocumento.ToUpper(),
            Estado = "PENDIENTE",
            IntentosRestantes = 3,
            ConsentimientoAceptado = true,
            FechaConsentimiento = DateTime.UtcNow,
            FechaCreacion = DateTime.UtcNow
        };

        _context.SolicitudesVerificacion.Add(nuevaSolicitud);
        await _context.SaveChangesAsync();

        await _audit.RegistrarEventoAsync(
            nuevaSolicitud.Id, null, "SOLICITUD_CREADA", "INFO",
            $"Solicitud iniciada para {nuevaSolicitud.NombrePersona} (Doc: {nuevaSolicitud.NumeroDocumento})",
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers["User-Agent"]);

        return Ok(new
        {
            Exito = true,
            CodigoSolicitud = nuevaSolicitud.CodigoSolicitud,
            Estado = nuevaSolicitud.Estado,
            IntentosRestantes = nuevaSolicitud.IntentosRestantes,
            Mensaje = "Solicitud creada. Proceda a cargar el documento oficial."
        });
    }

    [HttpPost("upload-document")]
    public async Task<IActionResult> UploadDocument([FromBody] DocumentUploadRequest request)
    {
        var solicitud = await _context.SolicitudesVerificacion
            .Include(s => s.Documento)
            .FirstOrDefaultAsync(s => s.CodigoSolicitud == request.CodigoSolicitud);

        if (solicitud == null)
        {
            return NotFound(new { Mensaje = "Solicitud de verificación no encontrada." });
        }

        if (solicitud.Estado == "BLOQUEADO" || solicitud.Estado == "APROBADO")
        {
            return BadRequest(new { Mensaje = $"La solicitud está en estado {solicitud.Estado} y no admite modificaciones." });
        }

        var (esValido, error, documento) = await _docService.ValidarYProcesarDocumentoAsync(solicitud, request);
        if (!esValido || documento == null)
        {
            await _audit.RegistrarEventoAsync(
                solicitud.Id, null, "CARGA_DOCUMENTO_RECHAZADA", "WARNING",
                $"Fallo de validación de documento: {error}",
                HttpContext.Connection.RemoteIpAddress?.ToString(),
                Request.Headers["User-Agent"]);

            return BadRequest(new { Mensaje = error });
        }

        // Si ya tenía documento cargado se reemplaza
        if (solicitud.Documento != null)
        {
            _context.DocumentosIdentidad.Remove(solicitud.Documento);
        }

        _context.DocumentosIdentidad.Add(documento);
        solicitud.Estado = "EN_PROCESO";
        await _context.SaveChangesAsync();

        await _audit.RegistrarEventoAsync(
            solicitud.Id, null, "DOCUMENTO_CARGADO", "INFO",
            $"Documento {documento.TipoDocumento} {documento.NumeroDocumento} cargado y validado (Hash: {documento.RutaArchivoHash[..8]}...)",
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers["User-Agent"]);

        return Ok(new
        {
            Exito = true,
            CodigoSolicitud = solicitud.CodigoSolicitud,
            Estado = solicitud.Estado,
            Mensaje = "Documento verificado correctamente. Puede iniciar la prueba de vida."
        });
    }

    [HttpPost("submit-attempt")]
    public async Task<IActionResult> SubmitVerificationAttempt([FromBody] SubmitVerificationAttemptRequest request)
    {
        var solicitud = await _context.SolicitudesVerificacion
            .Include(s => s.Documento)
            .Include(s => s.Intentos)
            .FirstOrDefaultAsync(s => s.CodigoSolicitud == request.CodigoSolicitud);

        if (solicitud == null)
        {
            return NotFound(new { Mensaje = "Solicitud no encontrada." });
        }

        if (solicitud.Estado is "APROBADO" or "RECHAZADO" or "REVISION_MANUAL")
        {
            return Conflict(new { Mensaje = $"La solicitud ya se encuentra en estado final {solicitud.Estado}." });
        }

        if (solicitud.Estado == "BLOQUEADO")
        {
            return StatusCode(429, new { Mensaje = "La solicitud ha sido bloqueada temporalmente por límite de intentos fallidos." });
        }

        if (solicitud.Documento == null)
        {
            return BadRequest(new { Mensaje = "Debe cargar primero el documento de identidad antes de realizar la prueba de vida." });
        }

        int numeroIntentoActual = solicitud.Intentos.Count + 1;
        solicitud.IntentosRestantes--;

        // 1. Evaluar Liveness
        var catalogoRetos = await _context.RetosLiveness.ToListAsync();
        var (livenessValido, scoreLiveness, sospechaFraude, motivoFraude) = 
            await _livenessService.EvaluarIntentoCompletoAsync(request, catalogoRetos);

        // 2. Evaluar Similitud Facial
        var (scoreSimilitud, clasificacionFacial, detalleFacial) = 
            await _faceService.CompararRostrosAsync(request.RostroCapturadoBase64, solicitud.Documento);

        // 3. Determinar estado de la solicitud
        string estadoFinal;
        string resultadoIntento;
        string mensajeResultado;

        if (sospechaFraude)
        {
            estadoFinal = "RECHAZADO";
            resultadoIntento = "FRAUDE_DETECTADO";
            mensajeResultado = $"Intento rechazado por detección de posible fraude: {motivoFraude}";
            await _notification.EnviarAlertaAsync("FRAUDE_DETECTADO", "seguridad@ugb.edu.sv", 
                $"Alerta de fraude en solicitud {solicitud.CodigoSolicitud}: {motivoFraude}");
        }
        else if (!livenessValido)
        {
            resultadoIntento = "FALLIDO_LIVENESS";
            mensajeResultado = $"Prueba de vida fallida. Score de viveza obtenido: {scoreLiveness * 100:0.0}%";
            
            if (solicitud.IntentosRestantes <= 0)
            {
                estadoFinal = "BLOQUEADO";
                mensajeResultado += ". Se agotaron los intentos disponibles. Solicitud bloqueada.";
            }
            else
            {
                estadoFinal = "EN_PROCESO";
                mensajeResultado += $". Le quedan {solicitud.IntentosRestantes} intentos.";
            }
        }
        else // Liveness es válido, evaluar rostro
        {
            if (clasificacionFacial == "APROBADO")
            {
                estadoFinal = "APROBADO";
                resultadoIntento = "EXITOSO";
                mensajeResultado = "Verificación completada con éxito. Identidad confirmada en tiempo real.";
                solicitud.FechaFinalizacion = DateTime.UtcNow;
            }
            else if (clasificacionFacial == "REVISION_MANUAL")
            {
                estadoFinal = "REVISION_MANUAL";
                resultadoIntento = "ZONA_GRIS_MANUAL";
                mensajeResultado = "Prueba de vida superada, pero la similitud requiere confirmación de un oficial de verificación.";
                await _notification.EnviarAlertaAsync("REVISION_MANUAL", "oficial@ugb.edu.sv", 
                    $"Solicitud {solicitud.CodigoSolicitud} enviada a revisión manual con score {scoreSimilitud * 100:0.0}%");
            }
            else
            {
                resultadoIntento = "FALLIDO_SIMILITUD";
                mensajeResultado = $"El rostro no coincide con el documento oficial. Score: {scoreSimilitud * 100:0.0}%";
                
                if (solicitud.IntentosRestantes <= 0)
                {
                    estadoFinal = "RECHAZADO";
                    mensajeResultado += ". Intentos agotados.";
                }
                else
                {
                    estadoFinal = "EN_PROCESO";
                    mensajeResultado += $". Le quedan {solicitud.IntentosRestantes} intentos.";
                }
            }
        }

        // Registrar Intento
        var nuevoIntento = new IntentoVerificacion
        {
            SolicitudId = solicitud.Id,
            NumeroIntento = numeroIntentoActual,
            DispositivoUserAgent = request.DispositivoUserAgent ?? Request.Headers["User-Agent"].ToString(),
            DireccionIP = HttpContext.Connection.RemoteIpAddress?.ToString(),
            SecuenciaRetosAsignada = JsonSerializer.Serialize(request.RespuestasRetos),
            SecuenciaRetosCumplida = livenessValido,
            ScoreLiveness = scoreLiveness,
            ScoreSimilitudFacial = scoreSimilitud,
            EsSospechaFotoImpresa = request.EstaticoDetectado,
            ResultadoIntento = resultadoIntento,
            DuracionSegundos = request.DuracionSegundos,
            FechaIntento = DateTime.UtcNow
        };

        _context.IntentosVerificacion.Add(nuevoIntento);

        solicitud.Estado = estadoFinal;
        solicitud.ScoreLivenessGlobal = scoreLiveness;
        solicitud.ScoreSimilitudFacial = scoreSimilitud;
        solicitud.Observaciones = mensajeResultado;

        await _context.SaveChangesAsync();

        await _audit.RegistrarEventoAsync(
            solicitud.Id, null, $"INTENTO_{resultadoIntento}", 
            sospechaFraude ? "CRITICAL" : (estadoFinal == "APROBADO" ? "INFO" : "WARNING"),
            $"Intento #{numeroIntentoActual}: Estado={estadoFinal}, Liveness={scoreLiveness:0.00}, Similitud={scoreSimilitud:0.00}. {mensajeResultado}",
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers["User-Agent"]);

        return Ok(new VerificationResultDto
        {
            CodigoSolicitud = solicitud.CodigoSolicitud,
            Estado = estadoFinal,
            ScoreLiveness = scoreLiveness,
            ScoreSimilitudFacial = scoreSimilitud,
            IntentosRestantes = solicitud.IntentosRestantes,
            Mensaje = mensajeResultado,
            EsSospechaFraude = sospechaFraude,
            TipoFraudeDetectado = motivoFraude,
            FechaProcesamiento = DateTime.UtcNow
        });
    }

    [HttpGet("{codigo}")]
    public async Task<IActionResult> GetStatus(string codigo)
    {
        var solicitud = await _context.SolicitudesVerificacion
            .Include(s => s.Documento)
            .Include(s => s.Intentos)
            .FirstOrDefaultAsync(s => s.CodigoSolicitud == codigo);

        if (solicitud == null)
        {
            return NotFound(new { Mensaje = "Solicitud no encontrada" });
        }

        return Ok(new
        {
            solicitud.CodigoSolicitud,
            solicitud.NombrePersona,
            solicitud.NumeroDocumento,
            solicitud.TipoDocumento,
            solicitud.Estado,
            solicitud.IntentosRestantes,
            solicitud.ScoreSimilitudFacial,
            solicitud.ScoreLivenessGlobal,
            solicitud.Observaciones,
            solicitud.FechaCreacion,
            TieneDocumentoCargado = solicitud.Documento != null,
            TotalIntentosRealizados = solicitud.Intentos.Count
        });
    }

    [Authorize(Roles = "Administrador,OficialVerificacion")]
    [HttpPost("manual-review")]
    public async Task<IActionResult> SubmitManualReview([FromBody] ManualReviewDecisionDto request)
    {
        var solicitud = await _context.SolicitudesVerificacion.FirstOrDefaultAsync(s => s.CodigoSolicitud == request.CodigoSolicitud);
        if (solicitud == null)
        {
            return NotFound(new { Mensaje = "Solicitud no encontrada" });
        }

        if (solicitud.Estado != "REVISION_MANUAL")
        {
            return BadRequest(new { Mensaje = "La solicitud no se encuentra en estado de revisión manual." });
        }

        string userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "1";
        int.TryParse(userIdStr, out int userId);

        solicitud.Estado = request.Decision.ToUpper() == "APROBADO" ? "APROBADO" : "RECHAZADO";
        solicitud.Observaciones = $"Revisión manual completada: {request.Observaciones}";
        solicitud.RevisadoPorUsuarioId = userId;
        solicitud.FechaFinalizacion = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _audit.RegistrarEventoAsync(
            solicitud.Id, userId, "REVISION_MANUAL_DECIDIDA", "INFO",
            $"Resolución manual: {solicitud.Estado}. Nota: {request.Observaciones}",
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers["User-Agent"]);

        return Ok(new
        {
            Exito = true,
            solicitud.CodigoSolicitud,
            solicitud.Estado,
            solicitud.Observaciones
        });
    }
}

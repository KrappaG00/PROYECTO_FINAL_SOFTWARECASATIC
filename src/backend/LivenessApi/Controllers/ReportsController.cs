using System.Text;
using LivenessApi.Data;
using LivenessApi.DTOs;
using LivenessApi.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LivenessApi.Controllers;

[Microsoft.AspNetCore.Authorization.Authorize(Roles = "Administrador,OficialVerificacion")]
[ApiController]
[Route("api/[controller]")]
public class ReportsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAuditService _audit;

    public ReportsController(ApplicationDbContext context, IAuditService audit)
    {
        _context = context;
        _audit = audit;
    }

    [HttpGet("metrics")]
    public async Task<IActionResult> GetMetrics()
    {
        var total = await _context.SolicitudesVerificacion.CountAsync();
        var aprobadas = await _context.SolicitudesVerificacion.CountAsync(s => s.Estado == "APROBADO");
        var rechazadas = await _context.SolicitudesVerificacion.CountAsync(s => s.Estado == "RECHAZADO");
        var manuales = await _context.SolicitudesVerificacion.CountAsync(s => s.Estado == "REVISION_MANUAL");
        var bloqueadas = await _context.SolicitudesVerificacion.CountAsync(s => s.Estado == "BLOQUEADO");

        var fraudes = await _context.IntentosVerificacion.CountAsync(i => i.EsSospechaPantalla || i.EsSospechaFotoImpresa);
        var totalIntentos = await _context.IntentosVerificacion.CountAsync();

        double tasaExito = total > 0 ? ((double)aprobadas / total) * 100.0 : 0.0;
        double tasaFraude = totalIntentos > 0 ? ((double)fraudes / totalIntentos) * 100.0 : 0.0;

        var tiempos = await _context.IntentosVerificacion.Where(i => i.DuracionSegundos > 0).Select(i => i.DuracionSegundos).ToListAsync();
        double tiempoPromedio = tiempos.Count > 0 ? tiempos.Average() : 0;

        var scoresLiveness = await _context.SolicitudesVerificacion.Where(s => s.ScoreLivenessGlobal > 0).Select(s => s.ScoreLivenessGlobal).ToListAsync();
        double livenessProm = scoresLiveness.Count > 0 ? scoresLiveness.Average() : 0;

        var scoresSimilitud = await _context.SolicitudesVerificacion.Where(s => s.ScoreSimilitudFacial > 0).Select(s => s.ScoreSimilitudFacial).ToListAsync();
        double similitudProm = scoresSimilitud.Count > 0 ? scoresSimilitud.Average() : 0;

        var metrica = new SystemMetricsDto
        {
            TotalSolicitudes = total,
            SolicitudesAprobadas = aprobadas,
            SolicitudesRechazadas = rechazadas,
            SolicitudesRevisionManual = manuales,
            IntentosBloqueados = bloqueadas,
            TasaExitoPorcentaje = Math.Round(tasaExito, 2),
            TasaFraudePorcentaje = Math.Round(tasaFraude, 2),
            TiempoPromedioVerificacionSegundos = Math.Round(tiempoPromedio, 2),
            ScoreLivenessPromedio = Math.Round(livenessProm, 2),
            ScoreSimilitudPromedio = Math.Round(similitudProm, 2)
        };

        return Ok(metrica);
    }

    [HttpGet("audit-logs")]
    public async Task<IActionResult> GetAuditLogs([FromQuery] int limite = 100)
    {
        var logs = await _audit.ObtenerLogsAsync(limite);
        var dtos = logs.Select(l => new AuditLogDto
        {
            Id = l.Id,
            SolicitudId = l.SolicitudId,
            Evento = l.Evento,
            NivelSeveridad = l.NivelSeveridad,
            Detalle = l.Detalle,
            HashIntegridad = l.HashIntegridad,
            DireccionIP = l.DireccionIP,
            FechaRegistro = l.FechaRegistro
        });

        return Ok(dtos);
    }

    [HttpGet("export/csv")]
    public async Task<IActionResult> ExportCsv()
    {
        var solicitudes = await _context.SolicitudesVerificacion
            .OrderByDescending(s => s.FechaCreacion)
            .ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("CodigoSolicitud,NombrePersona,NumeroDocumento,TipoDocumento,Estado,ScoreLiveness,ScoreSimilitud,FechaCreacion");

        foreach (var s in solicitudes)
        {
            sb.AppendLine($"{s.CodigoSolicitud},{s.NombrePersona},{s.NumeroDocumento},{s.TipoDocumento},{s.Estado},{s.ScoreLivenessGlobal:0.00},{s.ScoreSimilitudFacial:0.00},{s.FechaCreacion:yyyy-MM-dd HH:mm:ss}");
        }

        byte[] bytes = Encoding.UTF8.GetBytes(sb.ToString());
        return File(bytes, "text/csv", $"Reporte_Verificaciones_{DateTime.UtcNow:yyyyMMdd_HHmm}.csv");
    }
}

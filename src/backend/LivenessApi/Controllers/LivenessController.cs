using LivenessApi.Data;
using LivenessApi.DTOs;
using LivenessApi.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LivenessApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LivenessController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILivenessService _livenessService;

    public LivenessController(ApplicationDbContext context, ILivenessService livenessService)
    {
        _context = context;
        _livenessService = livenessService;
    }

    [HttpGet("challenges/{codigo}")]
    public async Task<IActionResult> GetChallenges(string codigo)
    {
        var solicitud = await _context.SolicitudesVerificacion.FirstOrDefaultAsync(s => s.CodigoSolicitud == codigo);
        if (solicitud == null)
        {
            return NotFound(new { Mensaje = "Solicitud no encontrada" });
        }

        var secuencia = await _livenessService.GenerarSecuenciaRetosAsync(codigo);
        return Ok(secuencia);
    }

    [HttpPost("analyze-frame")]
    public async Task<IActionResult> AnalyzeFrame([FromBody] FrameAnalysisRequest request)
    {
        var resultado = await _livenessService.AnalizarFrameAsync(request);
        return Ok(resultado);
    }

    [HttpGet("catalog")]
    public async Task<IActionResult> GetCatalog()
    {
        var retos = await _context.RetosLiveness.ToListAsync();
        return Ok(retos);
    }
}

using LivenessApi.Data;
using LivenessApi.DTOs;
using LivenessApi.Models;
using LivenessApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LivenessApi.Controllers;

[Authorize(Roles = "Administrador,OficialVerificacion")]
[ApiController]
[Route("api/[controller]")]
public class AdminController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IAuditService _audit;

    public AdminController(ApplicationDbContext context, IAuditService audit)
    {
        _context = context;
        _audit = audit;
    }

    [HttpGet("verifications")]
    public async Task<IActionResult> GetVerifications(
        [FromQuery] string? estado,
        [FromQuery] string? tipoDocumento,
        [FromQuery] string? buscar,
        [FromQuery] int pagina = 1,
        [FromQuery] int limite = 20)
    {
        var query = _context.SolicitudesVerificacion.AsQueryable();

        if (!string.IsNullOrWhiteSpace(estado) && estado != "TODOS")
        {
            query = query.Where(s => s.Estado == estado.ToUpper());
        }

        if (!string.IsNullOrWhiteSpace(tipoDocumento) && tipoDocumento != "TODOS")
        {
            query = query.Where(s => s.TipoDocumento == tipoDocumento.ToUpper());
        }

        if (!string.IsNullOrWhiteSpace(buscar))
        {
            string term = buscar.ToLower();
            query = query.Where(s => s.NombrePersona.ToLower().Contains(term) || 
                                     s.NumeroDocumento.ToLower().Contains(term) || 
                                     s.CodigoSolicitud.ToLower().Contains(term));
        }

        int total = await query.CountAsync();
        var items = await query
            .OrderByDescending(s => s.FechaCreacion)
            .Skip((pagina - 1) * limite)
            .Take(limite)
            .Select(s => new VerificationSummaryItemDto
            {
                Id = s.Id,
                CodigoSolicitud = s.CodigoSolicitud,
                NombrePersona = s.NombrePersona,
                NumeroDocumento = s.NumeroDocumento,
                TipoDocumento = s.TipoDocumento,
                Estado = s.Estado,
                ScoreSimilitudFacial = s.ScoreSimilitudFacial,
                ScoreLivenessGlobal = s.ScoreLivenessGlobal,
                IntentosRestantes = s.IntentosRestantes,
                FechaCreacion = s.FechaCreacion
            })
            .ToListAsync();

        return Ok(new
        {
            Total = total,
            Pagina = pagina,
            Limite = limite,
            TotalPaginas = (int)Math.Ceiling((double)total / limite),
            Items = items
        });
    }

    [HttpGet("config")]
    public async Task<IActionResult> GetConfigs()
    {
        var configs = await _context.ConfiguracionSistema.ToListAsync();
        return Ok(configs);
    }

    [Authorize(Roles = "Administrador")]
    [HttpPost("config")]
    public async Task<IActionResult> UpdateConfig([FromBody] ConfiguracionSistema item)
    {
        var existing = await _context.ConfiguracionSistema.FirstOrDefaultAsync(c => c.Clave == item.Clave);
        if (existing == null)
        {
            _context.ConfiguracionSistema.Add(item);
        }
        else
        {
            existing.Valor = item.Valor;
            existing.FechaModificacion = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        await _audit.RegistrarEventoAsync(null, null, "CONFIGURACION_MODIFICADA", "WARNING", 
            $"Parámetro {item.Clave} actualizado a {item.Valor}", 
            HttpContext.Connection.RemoteIpAddress?.ToString(), 
            Request.Headers["User-Agent"]);

        return Ok(new { Exito = true, Mensaje = "Configuración actualizada correctamente" });
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _context.Usuarios
            .Include(u => u.Rol)
            .Select(u => new
            {
                u.Id,
                u.NombreCompleto,
                u.Email,
                Rol = u.Rol != null ? u.Rol.Nombre : "Sin Rol",
                u.Activo,
                u.MfaHabilitado,
                u.FechaCreacion,
                u.UltimoAcceso
            })
            .ToListAsync();

        return Ok(users);
    }
}

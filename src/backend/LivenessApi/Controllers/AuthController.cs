using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using LivenessApi.Data;
using LivenessApi.DTOs;
using LivenessApi.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace LivenessApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    // Bloqueo temporal por correo: 5 fallos => 15 min (en memoria; con varias instancias usar Redis/BD).
    private static readonly ConcurrentDictionary<string, (int Fallos, DateTime? BloqueadoHasta)> Intentos = new();
    private const int MaxFallos = 5;
    private static readonly TimeSpan Bloqueo = TimeSpan.FromMinutes(15);

    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _config;
    private readonly IAuditService _audit;

    public AuthController(ApplicationDbContext context, IConfiguration config, IAuditService audit)
    {
        _context = context; _config = config; _audit = audit;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new LoginResponse { Exito = false, Mensaje = "Email y contraseña requeridos" });

        string email = request.Email.Trim().ToLowerInvariant();
        string ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "";
        string ua = Request.Headers["User-Agent"].ToString();

        if (Intentos.TryGetValue(email, out var est) && est.BloqueadoHasta > DateTime.UtcNow)
            return StatusCode(429, new LoginResponse { Exito = false, Mensaje = "Cuenta bloqueada temporalmente por intentos fallidos." });

        var usuario = await _context.Usuarios.Include(u => u.Rol)
            .FirstOrDefaultAsync(u => u.Email.ToLower() == email && u.Activo);

        if (usuario == null || !PasswordHasher.Verify(request.Password, usuario.PasswordHash))
        {
            var n = Intentos.AddOrUpdate(email, (1, null), (_, v) =>
                v.Fallos + 1 >= MaxFallos ? (0, DateTime.UtcNow.Add(Bloqueo)) : (v.Fallos + 1, null));
            await _audit.RegistrarEventoAsync(null, usuario?.Id, "INICIO_SESION_FALLIDO", "WARNING",
                $"Credenciales inválidas para {email}", ip, ua);
            return Unauthorized(new LoginResponse { Exito = false, Mensaje = "Credenciales incorrectas." });
        }

        Intentos.TryRemove(email, out _);

        var key = Encoding.UTF8.GetBytes(_config["Jwt:Key"]!);
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
                new Claim(ClaimTypes.Name, usuario.NombreCompleto),
                new Claim(ClaimTypes.Email, usuario.Email),
                new Claim(ClaimTypes.Role, usuario.Rol?.Nombre ?? "UsuarioCliente")
            }),
            Issuer = _config["Jwt:Issuer"],
            Audience = _config["Jwt:Audience"],
            Expires = DateTime.UtcNow.AddMinutes(60),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256)
        };
        var handler = new JwtSecurityTokenHandler();
        string jwt = handler.WriteToken(handler.CreateToken(descriptor));

        usuario.UltimoAcceso = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        await _audit.RegistrarEventoAsync(null, usuario.Id, "INICIO_SESION_EXITOSO", "INFO",
            $"Inicio de sesión de {usuario.Email} ({usuario.Rol?.Nombre})", ip, ua);

        return Ok(new LoginResponse { Exito = true, Token = jwt, UsuarioNombre = usuario.NombreCompleto, Rol = usuario.Rol?.Nombre, Mensaje = "Autenticación exitosa" });
    }
}

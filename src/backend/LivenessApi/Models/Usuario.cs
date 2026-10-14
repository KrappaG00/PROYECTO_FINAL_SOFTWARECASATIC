using System.Text.Json.Serialization;

namespace LivenessApi.Models;

public class Usuario
{
    public int Id { get; set; }
    public int RolId { get; set; }
    public string NombreCompleto { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;

    [JsonIgnore]
    public string PasswordHash { get; set; } = string.Empty;

    public bool MfaHabilitado { get; set; } = false;
    public string? MfaSecretKey { get; set; }
    public bool Activo { get; set; } = true;
    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    public DateTime? UltimoAcceso { get; set; }

    public Rol? Rol { get; set; }
    public ICollection<SolicitudVerificacion> Solicitudes { get; set; } = new List<SolicitudVerificacion>();
}

using System.ComponentModel.DataAnnotations;

namespace LivenessApi.Models;

public class ConfiguracionSistema
{
    [Key]
    public string Clave { get; set; } = string.Empty;
    public string Valor { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public DateTime FechaModificacion { get; set; } = DateTime.UtcNow;
}

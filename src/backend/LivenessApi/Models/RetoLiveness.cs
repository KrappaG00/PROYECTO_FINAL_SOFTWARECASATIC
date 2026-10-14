namespace LivenessApi.Models;

public class RetoLiveness
{
    public int Id { get; set; }
    public string CodigoReto { get; set; } = string.Empty;
    public string NombreReto { get; set; } = string.Empty;
    public string InstruccionUsuario { get; set; } = string.Empty;
    public int TiempoLimiteSegundos { get; set; } = 15;
    public string IconoClave { get; set; } = "eye";
}

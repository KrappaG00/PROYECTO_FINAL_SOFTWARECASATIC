namespace LivenessApi.DTOs;

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? CodigoMfa { get; set; }
}

public class LoginResponse
{
    public bool Exito { get; set; }
    public string? Token { get; set; }
    public string? Mensaje { get; set; }
    public bool RequiereMfa { get; set; }
    public string? UsuarioNombre { get; set; }
    public string? Rol { get; set; }
}

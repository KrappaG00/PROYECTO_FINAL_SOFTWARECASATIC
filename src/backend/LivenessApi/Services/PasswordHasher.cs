using System.Security.Cryptography;

namespace LivenessApi.Services;

/// <summary>
/// Hash de contraseñas con PBKDF2-HMAC-SHA256 (600k iteraciones, sal aleatoria de 16 bytes).
/// Formato almacenado: pbkdf2$iteraciones$salBase64$hashBase64.
/// Comparación en tiempo constante para evitar ataques de temporización.
/// </summary>
public static class PasswordHasher
{
    private const int Iteraciones = 600_000;
    private const int TamanoSal = 16;
    private const int TamanoHash = 32;

    public static string Hash(string password)
    {
        var sal = RandomNumberGenerator.GetBytes(TamanoSal);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, sal, Iteraciones, HashAlgorithmName.SHA256, TamanoHash);
        return $"pbkdf2${Iteraciones}${Convert.ToBase64String(sal)}${Convert.ToBase64String(hash)}";
    }

    public static bool Verify(string password, string almacenado)
    {
        var partes = almacenado.Split('$');
        if (partes.Length != 4 || partes[0] != "pbkdf2" || !int.TryParse(partes[1], out int iter)) return false;
        var sal = Convert.FromBase64String(partes[2]);
        var esperado = Convert.FromBase64String(partes[3]);
        var actual = Rfc2898DeriveBytes.Pbkdf2(password, sal, iter, HashAlgorithmName.SHA256, esperado.Length);
        return CryptographicOperations.FixedTimeEquals(actual, esperado);
    }
}

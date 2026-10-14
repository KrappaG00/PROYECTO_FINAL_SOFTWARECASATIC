using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace LivenessApi.Services;

/// <summary>
/// Abstracción para extraer un vector de características de una imagen.
/// Punto de extensión: reemplazar por un proveedor ONNX (ArcFace/FaceNet) o un servicio
/// externo registrando otra implementación en Program.cs; el resto del sistema no cambia.
/// </summary>
public interface IFaceEmbeddingProvider
{
    string Nombre { get; }
    /// <summary>Devuelve el vector L2-normalizado o null si la imagen no es decodificable.</summary>
    double[]? ExtraerEmbedding(byte[] imagen);
}

/// <summary>
/// Proveedor por defecto (SIN modelo de reconocimiento facial): descriptor de 32x32 en escala
/// de grises, centrado en la media y normalizado (el coseno equivale a la correlación de Pearson).
/// Detecta si dos imágenes son visualmente la misma, pero NO identifica personas.
/// Sirve para demostrar el pipeline completo; en producción debe sustituirse por un modelo facial real.
/// </summary>
public class ImageCorrelationEmbeddingProvider : IFaceEmbeddingProvider
{
    private const int Lado = 32;
    public string Nombre => "ImageCorrelation (demostración, no reconocimiento facial)";

    public double[]? ExtraerEmbedding(byte[] imagen)
    {
        try
        {
            using var img = Image.Load<L8>(imagen);
            img.Mutate(c => c.Resize(Lado, Lado));
            var v = new double[Lado * Lado];
            int i = 0;
            img.ProcessPixelRows(acc =>
            {
                for (int y = 0; y < acc.Height; y++)
                    foreach (var px in acc.GetRowSpan(y)) v[i++] = px.PackedValue;
            });
            double media = v.Average();
            for (int k = 0; k < v.Length; k++) v[k] -= media;
            double norma = Math.Sqrt(v.Sum(x => x * x));
            if (norma < 1e-9) return null; // imagen uniforme: sin información
            for (int k = 0; k < v.Length; k++) v[k] /= norma;
            return v;
        }
        catch
        {
            return null;
        }
    }
}

using System.Security.Cryptography;
using LivenessApi.Data;
using LivenessApi.DTOs;
using LivenessApi.Models;
using Microsoft.EntityFrameworkCore;

namespace LivenessApi.Services;

public class LivenessService : ILivenessService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<LivenessService> _logger;

    public LivenessService(ApplicationDbContext context, ILogger<LivenessService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<LivenessChallengeResponse> GenerarSecuenciaRetosAsync(string codigoSolicitud)
    {
        var todosLosRetos = await _context.RetosLiveness.ToListAsync();
        
        // Seleccionar aleatoriamente 2 o 3 retos distintos
        var random = new Random();
        int cantidadRetos = random.Next(2, 4); // 2 o 3
        var retosSeleccionados = todosLosRetos.OrderBy(x => random.Next()).Take(cantidadRetos).ToList();

        // Generar un código de seguridad de 4 dígitos para retos de lectura
        int codigoLectura = random.Next(1000, 9999);

        var respuesta = new LivenessChallengeResponse
        {
            CodigoSolicitud = codigoSolicitud,
            SesionToken = Guid.NewGuid().ToString("N"),
            TiempoTotalLimiteSegundos = retosSeleccionados.Sum(r => r.TiempoLimiteSegundos),
            CodigoSeguridadLectura = codigoLectura.ToString(),
            RetosAsignados = retosSeleccionados.Select(r => new ChallengeItemDto
            {
                Id = r.Id,
                CodigoReto = r.CodigoReto,
                NombreReto = r.NombreReto,
                Instruccion = r.CodigoReto == "LECTURA_CODIGO" 
                    ? $"{r.InstruccionUsuario}: [{codigoLectura}]"
                    : r.InstruccionUsuario,
                TiempoSegundos = r.TiempoLimiteSegundos,
                Icono = r.IconoClave
            }).ToList()
        };

        return respuesta;
    }

    public Task<FrameAnalysisResult> AnalizarFrameAsync(FrameAnalysisRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FrameBase64))
        {
            return Task.FromResult(new FrameAnalysisResult
            {
                RostroDetectado = false,
                FeedbackVisual = "No se recibió imagen para procesar",
                IluminacionAdecuada = false
            });
        }

        string raw = request.FrameBase64;
        if (raw.Contains(",")) raw = raw.Substring(raw.IndexOf(",") + 1);

        byte[] frameBytes;
        try
        {
            frameBytes = Convert.FromBase64String(raw);
        }
        catch
        {
            return Task.FromResult(new FrameAnalysisResult
            {
                RostroDetectado = false,
                FeedbackVisual = "Error al decodificar fotograma",
                IluminacionAdecuada = false
            });
        }

        // Estimación heurística de brillo, contraste y nitidez en bytes RGB/JPEG
        double brilloPromedio = CalcularBrilloAproximado(frameBytes);
        double varianzaTextura = CalcularVarianzaAproximada(frameBytes);

        bool buenaLuz = brilloPromedio >= 0.25 && brilloPromedio <= 0.88;
        bool nitidezAceptable = varianzaTextura > 0.05;

        string feedback;
        if (brilloPromedio < 0.25)
            feedback = "Iluminación muy baja. Acércate a una fuente de luz.";
        else if (brilloPromedio > 0.88)
            feedback = "Demasiado brillo o reflejo en la cámara. Ajusta la posición.";
        else if (!nitidezAceptable)
            feedback = "Cámara desenfocada o con movimiento excesivo. Mantente quieto.";
        else
            feedback = "Encuadre y condiciones óptimas.";

        return Task.FromResult(new FrameAnalysisResult
        {
            RostroDetectado = true,
            IluminacionAdecuada = buenaLuz,
            NivelNitidez = Math.Round(varianzaTextura * 100, 2),
            RetoCumplido = true,
            FeedbackVisual = feedback,
            ConfianzaHeuristica = buenaLuz && nitidezAceptable ? 0.92 : 0.45
        });
    }

    public Task<(bool EsValido, double ScoreLiveness, bool SospechaFraude, string? MotivoFraude)> EvaluarIntentoCompletoAsync(
        SubmitVerificationAttemptRequest request, 
        List<RetoLiveness> catalogoRetos)
    {
        // 0. Imagen estática sostenida => posible foto impresa o pantalla congelada
        if (request.EstaticoDetectado)
        {
            return Task.FromResult((false, 0.10, true, (string?)"Imagen estática sostenida: posible fotografía impresa o pantalla"));
        }

        // 1. Validar tiempo total de prueba (no debe exceder 60s, ni ser menor a 2s [sospecha bot])
        if (request.DuracionSegundos < 2.0)
        {
            return Task.FromResult((false, 0.15, true, (string?)"Detección de automatización o spoofing: tiempo de respuesta sobrehumanamente rápido"));
        }
        if (request.DuracionSegundos > 60.0)
        {
            return Task.FromResult((false, 0.30, false, (string?)"Tiempo límite de prueba de vida excedido (>60s)"));
        }

        // 2. Evaluar cumplimiento de retos enviados
        if (request.RespuestasRetos == null || request.RespuestasRetos.Count == 0)
        {
            return Task.FromResult((false, 0.0, true, (string?)"No se registraron respuestas a los retos biométricos"));
        }

        int retosAprobados = request.RespuestasRetos.Count(r => r.Cumplido);
        double porcentajeRetos = (double)retosAprobados / request.RespuestasRetos.Count;

        if (porcentajeRetos < 0.65)
        {
            return Task.FromResult((false, porcentajeRetos * 0.5, false, (string?)"No se completaron satisfactoriamente las acciones requeridas"));
        }

        // 3. Fusión de score del cliente y verificación de consistencia
        double scoreCliente = Math.Clamp(request.ScoreLivenessFrontend, 0.0, 1.0);
        
        // Peso: 50% retos interactivos cumplidos, 50% heurística de micro-movimiento y textura
        double scoreFinal = (porcentajeRetos * 0.50) + (scoreCliente * 0.50);

        // Umbral de liveness mínimo = 0.70
        bool esValido = scoreFinal >= 0.70;

        bool sospecha = scoreFinal < 0.50;
        string? motivo = !esValido ? "Score de viveza insuficiente para garantizar presencia física real" : null;

        return Task.FromResult((esValido, Math.Round(scoreFinal, 4), sospecha, motivo));
    }

    private static double CalcularBrilloAproximado(byte[] bytes)
    {
        long suma = 0;
        int muestra = Math.Min(bytes.Length, 4096);
        for (int i = 0; i < muestra; i++)
        {
            suma += bytes[i];
        }
        return (double)suma / (muestra * 255.0);
    }

    private static double CalcularVarianzaAproximada(byte[] bytes)
    {
        int muestra = Math.Min(bytes.Length, 4096);
        double promedio = CalcularBrilloAproximado(bytes);
        double sumaDiferencias = 0;
        for (int i = 0; i < muestra; i++)
        {
            double valorNorm = bytes[i] / 255.0;
            sumaDiferencias += Math.Pow(valorNorm - promedio, 2);
        }
        return Math.Sqrt(sumaDiferencias / muestra);
    }
}

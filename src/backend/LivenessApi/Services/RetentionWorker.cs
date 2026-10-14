using LivenessApi.Data;

namespace LivenessApi.Services;

/// <summary>
/// Sustituye datos biométricos vencidos según DIAS_RETENCION_BIOMETRICA (principio de minimización GDPR).
/// Conserva hash y auditoría; elimina embedding e imagen del documento.
/// </summary>
public class RetentionWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<RetentionWorker> _log;

    public RetentionWorker(IServiceScopeFactory scopes, ILogger<RetentionWorker> log) { _scopes = scopes; _log = log; }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var cfg = db.ConfiguracionSistema.FirstOrDefault(c => c.Clave == "DIAS_RETENCION_BIOMETRICA");
                int dias = cfg != null && int.TryParse(cfg.Valor, out var d) ? d : 30;
                var limite = DateTime.UtcNow.AddDays(-dias);
                var vencidos = db.DocumentosIdentidad.Where(x => x.FechaCarga < limite && x.EmbeddingDocumento != null).ToList();
                foreach (var v in vencidos) { v.EmbeddingDocumento = null; v.RostroDocumentoBase64 = null; }
                if (vencidos.Count > 0) { await db.SaveChangesAsync(ct); _log.LogInformation("Retención: {N} documentos depurados", vencidos.Count); }
            }
            catch (Exception ex) { _log.LogError(ex, "Error en purga de retención"); }
            await Task.Delay(TimeSpan.FromHours(6), ct);
        }
    }
}

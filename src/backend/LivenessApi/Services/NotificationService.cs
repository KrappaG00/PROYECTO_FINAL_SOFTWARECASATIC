namespace LivenessApi.Services;

public class NotificationService : INotificationService
{
    private readonly ILogger<NotificationService> _logger;

    public NotificationService(ILogger<NotificationService> logger)
    {
        _logger = logger;
    }

    public Task EnviarAlertaAsync(string tipoAlerta, string destinatario, string mensaje, object? datosAdicionales = null)
    {
        // En entorno productivo puede conectarse a SMTP/SendGrid, Webhook o SMS
        _logger.LogWarning("[NOTIFICACION-{Tipo}] Destinatario: {Dest} | Mensaje: {Msg}", tipoAlerta, destinatario, mensaje);
        return Task.CompletedTask;
    }
}

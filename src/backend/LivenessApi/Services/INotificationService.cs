namespace LivenessApi.Services;

public interface INotificationService
{
    Task EnviarAlertaAsync(string tipoAlerta, string destinatario, string mensaje, object? datosAdicionales = null);
}

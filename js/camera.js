/**
 * Módulo de Cámara y Manejo de Hardware WebRTC
 * Sistema de Pruebas de Vida - Grupo 4 (CASATIC / UGB)
 */

export class CameraService {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement || document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.stream = null;
    this.isStreaming = false;

    // Vincular cierre al descargar ventana
    window.addEventListener('beforeunload', () => this.detener());
  }

  static verificarCompatibilidad() {
    const soporteMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const soporteCanvas = !!window.CanvasRenderingContext2D;
    return {
      compatible: soporteMedia && soporteCanvas,
      soporteMedia,
      soporteCanvas,
      mensaje: (!soporteMedia || !soporteCanvas)
        ? "Tu navegador no soporta captura de video o procesamiento en Canvas. Por favor usa Chrome, Edge o Firefox moderno."
        : "Navegador 100% compatible con WebRTC y Canvas API."
    };
  }

  async encender(opciones = {}) {
    const constraints = {
      video: {
        width: { ideal: opciones.width || 1280 },
        height: { ideal: opciones.height || 720 },
        facingMode: opciones.facingMode || 'user',
        frameRate: { ideal: 30, max: 30 }
      },
      audio: false
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      await this.video.play();
      this.isStreaming = true;

      // Sincronizar dimensiones de canvas con el stream real
      const track = this.stream.getVideoTracks()[0];
      const settings = track.getSettings();
      this.canvas.width = settings.width || 640;
      this.canvas.height = settings.height || 480;

      return {
        exito: true,
        resolucion: `${this.canvas.width}x${this.canvas.height}`,
        track: track.label
      };
    } catch (error) {
      this.isStreaming = false;
      let errorMsg = "No se pudo acceder a la cámara.";

      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        errorMsg = "Permiso de cámara denegado. Habilita el acceso en el ícono de candado del navegador.";
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        errorMsg = "No se detectó ninguna cámara conectada en tu equipo.";
      } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        errorMsg = "La cámara está siendo utilizada por otra aplicación (Zoom, Teams, etc.).";
      }

      console.error("[CameraService Error]:", error);
      throw new Error(errorMsg);
    }
  }

  detener() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
    this.isStreaming = false;
  }

  capturarFrameBase64(formato = 'image/jpeg', calidad = 0.92) {
    if (!this.isStreaming || !this.video) return null;
    this.canvas.width = this.video.videoWidth || 640;
    this.canvas.height = this.video.videoHeight || 480;
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    return this.canvas.toDataURL(formato, calidad);
  }

  obtenerImageData(anchoAnalisis = 320) {
    if (!this.isStreaming || !this.video || !this.video.videoWidth) return null;
    const w = anchoAnalisis;
    const h = Math.round(anchoAnalisis * this.video.videoHeight / this.video.videoWidth);
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.drawImage(this.video, 0, 0, w, h);
    return this.ctx.getImageData(0, 0, w, h);
  }
}

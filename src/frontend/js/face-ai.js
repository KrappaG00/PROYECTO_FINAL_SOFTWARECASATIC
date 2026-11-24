/**
 * Motor de Reconocimiento Facial y Landmarks 100% Gratuito (MIT / Open Source)
 * Utiliza @vladmandic/face-api en el navegador (WebGL/CPU, sin APIs de pago).
 */

const FACE_API_CDN = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.esm.js';
const MODELS_CDN = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

export class FaceAIService {
  constructor() {
    this.faceapi = null;
    this.cargado = false;
    this.cargando = null;
    this.disponible = true;
  }

  async init() {
    if (this.cargado) return true;
    if (this.cargando) return this.cargando;

    this.cargando = (async () => {
      try {
        const mod = await import(/* @vite-ignore */ FACE_API_CDN);
        this.faceapi = mod.default || mod;
        await Promise.all([
          this.faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_CDN),
          this.faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_CDN),
          this.faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_CDN)
        ]);
        this.cargado = true;
        this.disponible = true;
        return true;
      } catch (err) {
        console.warn('[FaceAIService] Modelos no disponibles, usando modo heurístico:', err);
        this.disponible = false;
        this.cargado = false;
        return false;
      } finally {
        this.cargando = null;
      }
    })();

    return this.cargando;
  }

  /**
   * Detecta el rostro principal en una imagen Base64, lo recorta a 160x160
   * y extrae su descriptor neuronal de 128 dimensiones.
   */
  async detectarYExtraer(base64Image) {
    const ok = await this.init();
    if (!ok || !this.faceapi) return null;

    const img = await this._cargarImagen(base64Image);
    if (!img) return null;

    const opts = new this.faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 });
    const det = await this.faceapi
      .detectSingleFace(img, opts)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!det) return { detectado: false };

    const box = det.detection.box;
    const rostroRecortadoBase64 = this._recortarRostro(img, box);
    const descriptor = this._normalizarL2(Array.from(det.descriptor));

    return {
      detectado: true,
      score: det.detection.score,
      box,
      descriptor128: descriptor,
      rostroRecortadoBase64
    };
  }

  /**
   * Analiza un elemento <video> en tiempo real y retorna métricas faciales de landmarks:
   * - EAR (Eye Aspect Ratio) para parpadeo
   * - yawRatio para giro izquierda/derecha
   * - sonrisaRatio para sonrisa
   */
  async analizarVideo(videoEl) {
    if (!this.cargado || !this.faceapi || !videoEl || videoEl.readyState < 2) return null;

    const opts = new this.faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 });
    const det = await this.faceapi
      .detectSingleFace(videoEl, opts)
      .withFaceLandmarks();

    if (!det) {
      return { rostroDetectado: false };
    }

    const pts = det.landmarks.positions;
    const earIzq = this._calcularEAR(pts.slice(36, 42));
    const earDer = this._calcularEAR(pts.slice(42, 48));
    const ear = (earIzq + earDer) / 2;

    // Yaw: posición horizontal de la punta de la nariz (30) respecto a ojos externos (36 y 45)
    const ojoIzqX = pts[36].x;
    const ojoDerX = pts[45].x;
    const narizX = pts[30].x;
    const anchoOjos = Math.max(1, Math.abs(ojoDerX - ojoIzqX));
    const yawRatio = (narizX - ojoIzqX) / anchoOjos; // ~0.5 centrado; <0.35 o >0.65 girado

    // Sonrisa: ancho de boca (48-54) relativo al ancho entre ojos
    const anchoBoca = this._dist(pts[48], pts[54]);
    const sonrisaRatio = anchoBoca / anchoOjos; // > 0.78 suele indicar sonrisa

    return {
      rostroDetectado: true,
      ear,
      yawRatio,
      sonrisaRatio,
      box: det.detection.box
    };
  }

  /**
   * Similitud calibrada [0, 1] a partir de distancia Euclidiana entre descriptores 128-D.
   */
  calcularSimilitudDescriptores(desc1, desc2) {
    if (!desc1 || !desc2 || desc1.length !== desc2.length) return 0;
    let sumSq = 0;
    for (let i = 0; i < desc1.length; i++) {
      const d = desc1[i] - desc2[i];
      sumSq += d * d;
    }
    const dist = Math.sqrt(sumSq);
    // En face-api, misma persona suele dar distancia < 0.55; distinta > 0.65
    return Math.max(0, Math.min(1, 1 - (dist / 1.15)));
  }

  _calcularEAR(ojo) {
    const v1 = this._dist(ojo[1], ojo[5]);
    const v2 = this._dist(ojo[2], ojo[4]);
    const h = Math.max(1e-5, this._dist(ojo[0], ojo[3]));
    return (v1 + v2) / (2.0 * h);
  }

  _dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  _normalizarL2(vec) {
    const norma = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0));
    if (norma < 1e-9) return vec;
    return vec.map(v => v / norma);
  }

  _recortarRostro(img, box) {
    const pad = Math.max(box.width, box.height) * 0.2;
    const sx = Math.max(0, box.x - pad);
    const sy = Math.max(0, box.y - pad);
    const sw = Math.min(img.width - sx, box.width + pad * 2);
    const sh = Math.min(img.height - sy, box.height + pad * 2);

    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 160, 160);
    return canvas.toDataURL('image/jpeg', 0.92);
  }

  _cargarImagen(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
}

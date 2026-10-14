/**
 * Motor Heurístico de Visión por Computadora y Liveness Detection en Cliente
 * Sistema de Pruebas de Vida - Grupo 4 (CASATIC / UGB)
 */

export class LivenessEngine {
  constructor() {
    this.frameAnterior = null;
    this.historialMovimiento = [];
    this.historialOjos = [];
    this.contadorParpadeos = 0;
    this.ultimoParpadeoTimestamp = 0;
    this.umbralParpadeo = 18; // Variación porcentual en área ocular
  }

  reset() {
    this.frameAnterior = null;
    this.historialMovimiento = [];
    this.historialOjos = [];
    this.contadorParpadeos = 0;
    this.ultimoParpadeoTimestamp = 0;
  }

  /**
   * Analiza iluminación, contraste y centrado dentro del óvalo guía
   */
  analizarCalidadYEncuadre(imageData) {
    const { data, width, height } = imageData;
    const totalPixels = width * height;
    let sumaLuminancia = 0;
    let maxLum = 0;
    let minLum = 255;

    // Región central del óvalo (aproximadamente 40% central del frame)
    const startX = Math.floor(width * 0.3);
    const endX = Math.floor(width * 0.7);
    const startY = Math.floor(height * 0.2);
    const endY = Math.floor(height * 0.8);

    let pixelesOvalo = 0;
    let sumaLumOvalo = 0;

    for (let y = 0; y < height; y += 4) { // Submuestreo por rendimiento 60fps
      for (let x = 0; x < width; x += 4) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        // Luminancia percibida ITU-R BT.601
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        sumaLuminancia += lum;
        if (lum > maxLum) maxLum = lum;
        if (lum < minLum) minLum = lum;

        if (x >= startX && x <= endX && y >= startY && y <= endY) {
          sumaLumOvalo += lum;
          pixelesOvalo++;
        }
      }
    }

    const muestraGlobal = (width / 4) * (height / 4);
    const brilloGlobal = sumaLuminancia / (muestraGlobal * 255);
    const brilloOvalo = pixelesOvalo > 0 ? sumaLumOvalo / (pixelesOvalo * 255) : brilloGlobal;
    const contraste = (maxLum - minLum) / 255;

    let mensaje = "Rostro centrado correctamente";
    let iluminacionOptima = true;

    if (brilloOvalo < 0.22) {
      mensaje = "Muy oscuro. Ilumina tu rostro";
      iluminacionOptima = false;
    } else if (brilloOvalo > 0.85) {
      mensaje = "Demasiado brillo / contraluz";
      iluminacionOptima = false;
    } else if (contraste < 0.25) {
      mensaje = "Bajo contraste. Ajusta tu posición";
      iluminacionOptima = false;
    }

    return {
      brillo: Math.round(brilloOvalo * 100),
      contraste: Math.round(contraste * 100),
      iluminacionOptima,
      mensaje
    };
  }

  /**
   * Calcula diferencia absoluta inter-frame (Optical Flow / Frame Difference)
   */
  calcularDiferenciaFotogramas(imageDataActual) {
    if (!this.frameAnterior) {
      this.frameAnterior = imageDataActual;
      return { deltaMovimiento: 0.05, esEstatico: false, esErratico: false };
    }

    const curr = imageDataActual.data;
    const prev = this.frameAnterior.data;
    const len = curr.length;
    let sumaDiferencia = 0;
    const step = 8; // Muestreo veloz
    let conteo = 0;

    for (let i = 0; i < len; i += step * 4) {
      const diffR = Math.abs(curr[i] - prev[i]);
      const diffG = Math.abs(curr[i + 1] - prev[i + 1]);
      const diffB = Math.abs(curr[i + 2] - prev[i + 2]);
      sumaDiferencia += (diffR + diffG + diffB) / 3;
      conteo++;
    }

    const delta = sumaDiferencia / (conteo * 255);
    this.frameAnterior = imageDataActual;

    this.historialMovimiento.push(delta);
    if (this.historialMovimiento.length > 20) this.historialMovimiento.shift();

    const promedioMov = this.historialMovimiento.reduce((a, b) => a + b, 0) / this.historialMovimiento.length;

    // Foto estática sostenida: delta promedio < 0.003
    const esEstatico = this.historialMovimiento.length >= 10 && promedioMov < 0.003;
    // Movimiento sobrehumano o distorsión errática: delta > 0.45
    const esErratico = delta > 0.45;

    return {
      deltaMovimiento: Math.round(delta * 1000) / 1000,
      promedioMov: Math.round(promedioMov * 1000) / 1000,
      esEstatico,
      esErratico
    };
  }

  /**
   * Detección Heurística de Parpadeo basada en variación de luminosidad en región ocular
   */
  analizarParpadeo(imageData) {
    const { data, width, height } = imageData;
    // La región ocular en un rostro centrado está aproximadamente en Y: 35%-48%, X: 35%-65%
    const eyeStartY = Math.floor(height * 0.35);
    const eyeEndY = Math.floor(height * 0.48);
    const eyeStartX = Math.floor(width * 0.35);
    const eyeEndX = Math.floor(width * 0.65);

    let sumaLum = 0;
    let pixeles = 0;

    for (let y = eyeStartY; y <= eyeEndY; y += 3) {
      for (let x = eyeStartX; x <= eyeEndX; x += 3) {
        const idx = (y * width + x) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        sumaLum += lum;
        pixeles++;
      }
    }

    const lumMediaOjos = sumaLum / pixeles;
    this.historialOjos.push(lumMediaOjos);
    if (this.historialOjos.length > 15) this.historialOjos.shift();

    let parpadeoRegistrado = false;
    if (this.historialOjos.length >= 6) {
      const minOjos = Math.min(...this.historialOjos);
      const maxOjos = Math.max(...this.historialOjos);
      const drop = maxOjos - minOjos;

      const ahora = Date.now();
      // Un parpadeo dura entre 150ms y 400ms, causando una caída abrupta y recuperación
      if (drop > this.umbralParpadeo && (ahora - this.ultimoParpadeoTimestamp > 500)) {
        this.contadorParpadeos++;
        this.ultimoParpadeoTimestamp = ahora;
        parpadeoRegistrado = true;
      }
    }

    return {
      parpadeosTotales: this.contadorParpadeos,
      parpadeoReciente: parpadeoRegistrado
    };
  }

  /**
   * Estimación de Giro de Cabeza (Izquierda / Derecha) por asimetría de masa de luminosidad
   */
  analizarGiroCabeza(imageData) {
    const { data, width, height } = imageData;
    const startY = Math.floor(height * 0.25);
    const endY = Math.floor(height * 0.75);
    const midX = Math.floor(width / 2);

    let masaIzquierda = 0;
    let masaDerecha = 0;

    for (let y = startY; y <= endY; y += 4) {
      for (let x = Math.floor(width * 0.2); x < midX; x += 4) {
        const idx = (y * width + x) * 4;
        masaIzquierda += (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      }
      for (let x = midX; x < Math.floor(width * 0.8); x += 4) {
        const idx = (y * width + x) * 4;
        masaDerecha += (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      }
    }

    const sumaTotal = masaIzquierda + masaDerecha;
    if (sumaTotal === 0) return { direccion: 'CENTRO', ratio: 1.0 };

    const ratio = masaIzquierda / masaDerecha;
    let direccion = 'CENTRO';

    // Desplazamiento perceptible al rotar
    if (ratio > 1.25) {
      direccion = 'DERECHA'; // Vista espejo
    } else if (ratio < 0.80) {
      direccion = 'IZQUIERDA';
    }

    return { direccion, ratio: Math.round(ratio * 100) / 100 };
  }

  /**
   * Evalúa si un reto específico está siendo cumplido en el frame actual
   */
  evaluarReto(codigoReto, imageData) {
    switch (codigoReto) {
      case 'PARPADEO_DOBLE': {
        const res = this.analizarParpadeo(imageData);
        return {
          cumplido: res.parpadeosTotales >= 2,
          progreso: Math.min(100, (res.parpadeosTotales / 2) * 100),
          feedback: `Parpadeos detectados: ${res.parpadeosTotales}/2`
        };
      }
      case 'GIRO_DERECHA': {
        const giro = this.analizarGiroCabeza(imageData);
        const ok = giro.direccion === 'DERECHA';
        return {
          cumplido: ok,
          progreso: ok ? 100 : 35,
          feedback: ok ? 'Giro a la derecha detectado ✓' : 'Gira suavemente la cabeza hacia la derecha'
        };
      }
      case 'GIRO_IZQUIERDA': {
        const giro = this.analizarGiroCabeza(imageData);
        const ok = giro.direccion === 'IZQUIERDA';
        return {
          cumplido: ok,
          progreso: ok ? 100 : 35,
          feedback: ok ? 'Giro a la izquierda detectado ✓' : 'Gira suavemente la cabeza hacia la izquierda'
        };
      }
      case 'SONREIR':
      case 'LECTURA_CODIGO':
      default: {
        // Validación de micro-movimiento activo y estabilidad en encuadre
        const diff = this.calcularDiferenciaFotogramas(imageData);
        const activo = diff.deltaMovimiento > 0.008 && !diff.esErratico;
        return {
          cumplido: activo,
          progreso: activo ? 100 : 40,
          feedback: activo ? 'Acción detectada satisfactoriamente ✓' : 'Mantén la mirada y realiza la acción requerida'
        };
      }
    }
  }
}

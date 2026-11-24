/**
 * Cliente de API REST — VeriCheck ID
 * Comunica con el backend ASP.NET Core (/api/...) mediante fetch.
 * Si se despliega en hosting puramente estático sin backend, el flujo público
 * de verificación opera en modo local temporal sin exponer datos ni credenciales.
 */

export class ApiService {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('liveness_auth_token') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('liveness_auth_token', token);
    } else {
      localStorage.removeItem('liveness_auth_token');
    }
  }

  getHeaders(isJson = true) {
    const headers = {};
    if (isJson) headers['Content-Type'] = 'application/json';
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    return headers;
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(options.body !== undefined),
        ...(options.headers || {})
      }
    });

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await res.json().catch(() => ({})) : null;

    if (!res.ok) {
      const msg = data?.mensaje || data?.Mensaje || data?.title || `Error HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.isStaticFallbackCandidate = res.status === 404 || res.status === 405;
      throw err;
    }

    return data;
  }

  // ---------- Autenticación de Operadores (solo servidor) ----------

  async login(email, password) {
    try {
      const data = await this.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (!data?.exito || !data?.token) {
        throw new Error(data?.mensaje || 'Credenciales incorrectas.');
      }
      this.setToken(data.token);
      return data;
    } catch (err) {
      if (err instanceof TypeError || err.isStaticFallbackCandidate) {
        throw new Error('No hay conexión con el servidor de autenticación.');
      }
      throw err;
    }
  }

  // ---------- Flujo Público de Verificación ----------

  async crearSolicitud(nombrePersona, numeroDocumento, tipoDocumento = 'DUI', aceptaConsentimiento = false) {
    if (!aceptaConsentimiento) {
      throw new Error('Debe aceptar el consentimiento para el tratamiento de datos biométricos.');
    }

    try {
      return await this.request('/api/verification/create', {
        method: 'POST',
        body: JSON.stringify({ nombrePersona, numeroDocumento, tipoDocumento, aceptaConsentimiento })
      });
    } catch (err) {
      if (!(err instanceof TypeError) && !err.isStaticFallbackCandidate) throw err;
      return this._crearSolicitudLocal(nombrePersona, numeroDocumento, tipoDocumento);
    }
  }

  async cargarDocumento(codigoSolicitud, imagenDocumentoBase64, tipoDocumento, numeroDocumento, embeddingFacial = null) {
    try {
      return await this.request('/api/verification/upload-document', {
        method: 'POST',
        body: JSON.stringify({ codigoSolicitud, imagenDocumentoBase64, tipoDocumento, numeroDocumento, embeddingFacial })
      });
    } catch (err) {
      if (!(err instanceof TypeError) && !err.isStaticFallbackCandidate) throw err;
      return this._cargarDocumentoLocal(codigoSolicitud, imagenDocumentoBase64, embeddingFacial);
    }
  }

  async obtenerRetos(codigoSolicitud) {
    try {
      return await this.request(`/api/liveness/challenges/${encodeURIComponent(codigoSolicitud)}`, {
        method: 'GET'
      });
    } catch (err) {
      if (!(err instanceof TypeError) && !err.isStaticFallbackCandidate) throw err;
      return this._obtenerRetosLocal(codigoSolicitud);
    }
  }

  async enviarIntentoVerificacion(payload) {
    try {
      return await this.request('/api/verification/submit-attempt', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    } catch (err) {
      if (!(err instanceof TypeError) && !err.isStaticFallbackCandidate) throw err;
      return this._enviarIntentoLocal(payload);
    }
  }

  // ---------- Endpoints Administrativos / Operadores ----------

  async obtenerVerificacionesAdmin(filtros = {}) {
    const params = new URLSearchParams();
    if (filtros.estado && filtros.estado !== 'TODOS') params.set('estado', filtros.estado);
    if (filtros.tipoDocumento && filtros.tipoDocumento !== 'TODOS') params.set('tipoDocumento', filtros.tipoDocumento);
    if (filtros.buscar) params.set('buscar', filtros.buscar);
    if (filtros.pagina) params.set('pagina', String(filtros.pagina));
    if (filtros.limite) params.set('limite', String(filtros.limite));
    const qs = params.toString();
    return await this.request(`/api/admin/verifications${qs ? `?${qs}` : ''}`, { method: 'GET' });
  }

  async obtenerMetricas() {
    return await this.request('/api/reports/metrics', { method: 'GET' });
  }

  async obtenerUsuariosAdmin() {
    return await this.request('/api/admin/users', { method: 'GET' });
  }

  async obtenerLogsAuditoria(limite = 50) {
    return await this.request(`/api/reports/audit-logs?limite=${encodeURIComponent(limite)}`, { method: 'GET' });
  }

  async resolverRevisionManual(codigoSolicitud, decision, motivo, observaciones = '') {
    const notaCompleta = observaciones ? `${motivo}. ${observaciones}` : motivo;
    return await this.request('/api/verification/manual-review', {
      method: 'POST',
      body: JSON.stringify({
        codigoSolicitud,
        decision,
        observaciones: notaCompleta
      })
    });
  }

  async exportarCsv() {
    const res = await fetch(`${this.baseUrl}/api/reports/export/csv`, {
      method: 'GET',
      headers: this.getHeaders(false)
    });
    if (!res.ok) {
      const err = new Error(`No se pudo exportar el reporte (HTTP ${res.status})`);
      err.status = res.status;
      throw err;
    }
    return await res.blob();
  }

  // ---------- Respaldo local (solo flujo público sin backend) ----------

  _crearSolicitudLocal(nombrePersona, numeroDocumento, tipoDocumento) {
    const codigo = 'SOL-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const solicitud = {
      codigoSolicitud: codigo,
      nombrePersona,
      numeroDocumento,
      tipoDocumento,
      estado: 'PENDIENTE',
      intentosRestantes: 3
    };
    sessionStorage.setItem(`sol_${codigo}`, JSON.stringify(solicitud));
    return solicitud;
  }

  async _cargarDocumentoLocal(codigoSolicitud, imagenBase64, embeddingFacial = null) {
    const raw = sessionStorage.getItem(`sol_${codigoSolicitud}`);
    if (!raw) throw new Error('Solicitud no encontrada.');
    const sol = JSON.parse(raw);
    const embedding = (Array.isArray(embeddingFacial) && embeddingFacial.length === 128)
      ? embeddingFacial
      : await this._extraerEmbeddingCanvas(imagenBase64);
    if (!embedding) throw new Error('El archivo no es una imagen válida.');
    sessionStorage.setItem(`doc_emb_${codigoSolicitud}`, JSON.stringify(embedding));
    sol.estado = 'EN_PROCESO';
    sessionStorage.setItem(`sol_${codigoSolicitud}`, JSON.stringify(sol));
    return { exito: true, codigoSolicitud, estado: 'EN_PROCESO' };
  }

  _obtenerRetosLocal(codigoSolicitud) {
    const catalogo = [
      { id: 1, codigoReto: 'PARPADEO_DOBLE', nombreReto: 'Parpadeo doble', instruccion: 'Parpadea lentamente dos veces mirando la cámara', tiempoSegundos: 12, icono: 'eye' },
      { id: 2, codigoReto: 'GIRO_DERECHA', nombreReto: 'Giro a la derecha', instruccion: 'Gira suavemente la cabeza hacia tu derecha y vuelve al centro', tiempoSegundos: 12, icono: 'arrow-right' },
      { id: 3, codigoReto: 'GIRO_IZQUIERDA', nombreReto: 'Giro a la izquierda', instruccion: 'Gira suavemente la cabeza hacia tu izquierda y vuelve al centro', tiempoSegundos: 12, icono: 'arrow-left' },
      { id: 4, codigoReto: 'SONREIR', nombreReto: 'Sonrisa natural', instruccion: 'Sonríe ligeramente y vuelve a la expresión neutra', tiempoSegundos: 10, icono: 'smile' }
    ];
    const n = Math.random() > 0.5 ? 2 : 3;
    const retosAsignados = [...catalogo].sort(() => 0.5 - Math.random()).slice(0, n);
    return { codigoSolicitud, retosAsignados };
  }

  async _enviarIntentoLocal(payload) {
    const rawSol = sessionStorage.getItem(`sol_${payload.codigoSolicitud}`);
    if (!rawSol) throw new Error('Solicitud no encontrada.');
    const sol = JSON.parse(rawSol);
    sol.intentosRestantes = Math.max(0, (sol.intentosRestantes ?? 3) - 1);

    if (payload.estaticoDetectado) {
      sol.estado = 'RECHAZADO';
      sessionStorage.setItem(`sol_${payload.codigoSolicitud}`, JSON.stringify(sol));
      return {
        codigoSolicitud: sol.codigoSolicitud,
        estado: 'RECHAZADO',
        scoreLiveness: 0.1,
        scoreSimilitudFacial: 0,
        intentosRestantes: sol.intentosRestantes,
        esSospechaFraude: true,
        mensaje: 'Intento rechazado por detección de imagen estática sostenida.'
      };
    }

    const rawDocEmb = sessionStorage.getItem(`doc_emb_${payload.codigoSolicitud}`);
    const embDoc = rawDocEmb ? JSON.parse(rawDocEmb) : null;
    let similitud = 0;

    if (Array.isArray(embDoc) && embDoc.length === 128 && Array.isArray(payload.embeddingFacial) && payload.embeddingFacial.length === 128) {
      let sumSq = 0;
      for (let i = 0; i < 128; i++) {
        const d = embDoc[i] - payload.embeddingFacial[i];
        sumSq += d * d;
      }
      similitud = Math.max(0, Math.min(1, 1 - (Math.sqrt(sumSq) / 1.15)));
    } else {
      const embVivo = await this._extraerEmbeddingCanvas(payload.rostroCapturadoBase64);
      similitud = this._calcularSimilitudCoseno(embVivo, embDoc);
    }
    similitud = Math.round(similitud * 100) / 100;

    const respuestas = payload.respuestasRetos || [];
    const aprobados = respuestas.filter(r => r.cumplido).length;
    const porcentajeRetos = respuestas.length > 0 ? aprobados / respuestas.length : 0;
    const scoreCliente = Math.max(0, Math.min(1, payload.scoreLivenessFrontend || 0));
    const scoreLiveness = Math.round(((porcentajeRetos * 0.5) + (scoreCliente * 0.5)) * 100) / 100;

    let estado = 'EN_PROCESO';
    let mensaje = '';
    if (scoreLiveness < 0.70) {
      estado = sol.intentosRestantes <= 0 ? 'BLOQUEADO' : 'EN_PROCESO';
      mensaje = `Prueba de vida insuficiente (${Math.round(scoreLiveness * 100)}%).`;
    } else if (similitud >= 0.75) {
      estado = 'APROBADO';
      mensaje = 'Verificación completada con éxito. Identidad confirmada en tiempo real.';
    } else if (similitud >= 0.60) {
      estado = 'REVISION_MANUAL';
      mensaje = 'Prueba de vida superada; la similitud requiere validación de un oficial.';
    } else {
      estado = sol.intentosRestantes <= 0 ? 'RECHAZADO' : 'EN_PROCESO';
      mensaje = `El rostro no coincide con el documento oficial (${Math.round(similitud * 100)}%).`;
    }

    sol.estado = estado;
    sessionStorage.setItem(`sol_${payload.codigoSolicitud}`, JSON.stringify(sol));
    return {
      codigoSolicitud: sol.codigoSolicitud,
      estado,
      scoreLiveness,
      scoreSimilitudFacial: similitud,
      intentosRestantes: sol.intentosRestantes,
      mensaje,
      fechaProcesamiento: new Date().toISOString()
    };
  }

  async _extraerEmbeddingCanvas(base64Image) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 32, 32);
        const data = ctx.getImageData(0, 0, 32, 32).data;

        const vector = new Float64Array(1024);
        let suma = 0;
        for (let i = 0; i < 1024; i++) {
          const idx = i * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          vector[i] = lum;
          suma += lum;
        }

        const media = suma / 1024;
        let sumaSq = 0;
        for (let i = 0; i < 1024; i++) {
          vector[i] -= media;
          sumaSq += vector[i] * vector[i];
        }
        const norma = Math.sqrt(sumaSq);
        if (norma < 1e-9) { resolve(null); return; }
        for (let i = 0; i < 1024; i++) vector[i] /= norma;
        resolve(Array.from(vector));
      };
      img.onerror = () => resolve(null);
      img.src = base64Image;
    });
  }

  _calcularSimilitudCoseno(v1, v2) {
    if (!v1 || !v2 || v1.length !== v2.length) return 0;
    let dot = 0;
    for (let i = 0; i < v1.length; i++) dot += v1[i] * v2[i];
    return Math.max(0, Math.min(1, dot));
  }
}

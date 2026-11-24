/**
 * Orquestador principal del frontend.
 * Sin datos simulados: si el backend falla, se muestra el error real al usuario.
 */
import { ApiService } from './api.js';
import { CameraService } from './camera.js';
import { FaceAIService } from './face-ai.js';
import { LivenessEngine } from './liveness.js';
import { UIManager } from './ui.js';

const $ = (id) => document.getElementById(id);

class AppController {
  constructor() {
    this.api = new ApiService();
    this.faceAi = new FaceAIService();
    this.liveness = new LivenessEngine();
    this.ui = new UIManager();
    this.camera = null;
    this.ultimoLandmarksAI = null;
    this.procesandoLandmarksAI = false;
    this.reset();
    this.init();
  }

  reset() {
    this.solicitudActual = null;
    this.retosAsignados = [];
    this.indiceRetoActual = 0;
    this.respuestasRetos = [];
    this.timerInterval = null;
    this.loopAnalisisId = null;
    this.documentoBase64 = null;
    this.rostroCapturaBase64 = null;
    this.tiempoInicioPrueba = null;
    this.enTransicionReto = false;
    this.ultimoResultado = null;
    this.resetTelemetria();
  }

  resetTelemetria() {
    this.tel = { frames: 0, framesMovimientoHumano: 0, framesEstaticos: 0, sumaDelta: 0 };
  }

  init() {
    const compat = CameraService.verificarCompatibilidad();
    const banner = $('bannerCompatibilidad');
    if (banner) {
      if (!compat.compatible) {
        banner.textContent = compat.mensaje;
        banner.className = 'banner-danger';
        banner.style.display = 'block';
      } else {
        banner.style.display = 'none';
      }
    }
    this.camera = new CameraService($('video'), $('canvasCaptura'));
    this.bindEvents();
    this.actualizarSesion();
    this.faceAi.init();
    if (window.location.hash === '#admin' && !this.api.token) {
      this.ui.abrirModalLogin();
    } else if (this.api.token) {
      this.cargarAdmin();
    }
  }

  bindEvents() {
    $('encenderCamara')?.addEventListener('click', () => this.iniciarCamara());
    $('apagarCamara')?.addEventListener('click', () => this.apagarCamara());
    $('inputDocumento')?.addEventListener('change', (e) => this.procesarArchivoDocumento(e));
    $('formNuevaSolicitud')?.addEventListener('submit', (e) => this.crearSolicitud(e));
    $('btnIniciarPrueba')?.addEventListener('click', () => this.iniciarSecuenciaPruebaDeVida());
    $('btnCerrarModal')?.addEventListener('click', () => this.cerrarResultado());
    $('btnCerrarModalManual')?.addEventListener('click', () => this.ui.cerrarModalRevisionManual());
    $('btnCancelarDecisionManual')?.addEventListener('click', () => this.ui.cerrarModalRevisionManual());
    $('btnAbrirLoginOperador')?.addEventListener('click', () => this.ui.abrirModalLogin());
    $('btnCerrarModalLogin')?.addEventListener('click', () => this.ui.cerrarModalLogin());
    $('formLogin')?.addEventListener('submit', (e) => this.login(e));
    $('btnLogout')?.addEventListener('click', () => this.logout());
    $('btnExportarCsv')?.addEventListener('click', () => this.exportarCsv());
    $('filtroEstado')?.addEventListener('change', () => this.cargarReportesFiltrados());

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', () => {
        const h = link.getAttribute('href');
        if (['#historial', '#usuarios', '#reportes'].includes(h) && this.api.token) this.cargarAdmin();
      });
    });

    window.addEventListener('hashchange', () => {
      const h = window.location.hash;
      if (h === '#admin' && !this.api.token) {
        this.ui.abrirModalLogin();
      } else if (['#historial', '#usuarios', '#reportes'].includes(h) && this.api.token) {
        this.cargarAdmin();
      }
    });
  }

  // ---------- Sesión administrativa ----------
  actualizarSesion() {
    const logged = !!this.api.token;
    const nombre = localStorage.getItem('liveness_user') || '';
    const rol = localStorage.getItem('liveness_role') || '';
    this.ui.actualizarVisibilidadOperador(logged, nombre, rol);
  }

  async login(e) {
    e.preventDefault();
    const btn = $('btnSubmitLogin');
    try {
      if (btn) { btn.disabled = true; btn.textContent = 'Verificando...'; }
      const res = await this.api.login($('loginEmail').value.trim(), $('loginPassword').value);
      localStorage.setItem('liveness_user', res.usuarioNombre || '');
      localStorage.setItem('liveness_role', res.rol || '');
      $('loginPassword').value = '';
      this.ui.cerrarModalLogin();
      this.actualizarSesion();
      await this.cargarAdmin();
      this.ui.mostrarSeccion('historial');
    } catch (err) {
      this.ui.mostrarErrorLogin(err.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Iniciar sesión'; }
    }
  }

  logout() {
    this.api.setToken(null);
    localStorage.removeItem('liveness_user');
    localStorage.removeItem('liveness_role');
    this.actualizarSesion();
    this.mensajeSinSesion('tablaHistorialBody', 7);
    this.mensajeSinSesion('tablaAdminBody', 7);
    this.mensajeSinSesion('tablaUsuariosBody', 5);
  }

  mensajeSinSesion(tbodyId, cols) {
    const tb = $(tbodyId);
    if (tb) tb.innerHTML = `<tr><td colspan="${cols}" style="text-align:center">Inicia sesión como operador autorizado para ver estos datos.</td></tr>`;
  }

  async cargarAdmin() {
    if (!this.api.token) {
      this.mensajeSinSesion('tablaHistorialBody', 7);
      this.mensajeSinSesion('tablaAdminBody', 7);
      this.mensajeSinSesion('tablaUsuariosBody', 5);
      const contenedorCasos = $('contenedorCasosManuales');
      if (contenedorCasos) {
        contenedorCasos.innerHTML = `<div class="caso-manual-vacio">Inicia sesión como operador autorizado para gestionar revisiones manuales.</div>`;
      }
      return;
    }
    try {
      const estadoFiltro = $('filtroEstado')?.value || 'TODOS';
      const [dataTodos, metricas, usuarios] = await Promise.all([
        this.api.obtenerVerificacionesAdmin({ limite: 100 }),
        this.api.obtenerMetricas(),
        this.api.obtenerUsuariosAdmin()
      ]);

      this.ui.renderizarCasosRevisionManual(dataTodos.items, (caso) => this.abrirModalRevision(caso));
      this.ui.renderizarTablaHistorial(dataTodos.items, (caso) => this.abrirModalRevision(caso));
      this.ui.renderizarMetricas(metricas);
      this.renderUsuarios(usuarios);

      if (estadoFiltro === 'TODOS') {
        this.ui.renderizarTablaAdmin(dataTodos.items);
      } else {
        await this.cargarReportesFiltrados();
      }
    } catch (err) {
      if (/401|403/.test(err.message) || err.status === 401 || err.status === 403) {
        this.logout();
      } else {
        alert('Error al cargar datos: ' + err.message);
      }
    }
  }

  async cargarReportesFiltrados() {
    if (!this.api.token) return;
    try {
      const estado = $('filtroEstado')?.value || 'TODOS';
      const data = await this.api.obtenerVerificacionesAdmin({ estado, limite: 100 });
      this.ui.renderizarTablaAdmin(data.items);
    } catch (err) {
      if (err.status === 401 || err.status === 403) this.logout();
      else alert('Error al filtrar reportes: ' + err.message);
    }
  }

  abrirModalRevision(caso) {
    this.ui.abrirModalRevisionManual(caso, async (codigo, decision, motivo, observaciones) => {
      try {
        const res = await this.api.resolverRevisionManual(codigo, decision, motivo, observaciones);
        const estadoRes = res?.estado || res?.solicitud?.estado || decision;
        alert(`Dictamen registrado con éxito: Solicitud ${codigo} -> ${estadoRes}`);
        await this.cargarAdmin();
      } catch (err) {
        alert('Error al resolver la revisión manual: ' + err.message);
      }
    });
  }

  renderUsuarios(users) {
    const tb = $('tablaUsuariosBody');
    if (!tb) return;
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    tb.innerHTML = users.map((u) => `<tr><td>${u.id}</td><td>${esc(u.nombreCompleto)}</td><td>${esc(u.email)}</td><td>${esc(u.rol)}</td><td>${u.activo ? 'Activo' : 'Inactivo'}</td></tr>`).join('');
  }

  async exportarCsv() {
    if (!this.api.token) return this.ui.abrirModalLogin();
    try {
      const blob = await this.api.exportarCsv();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Reporte_Verificaciones_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      if (e.status === 401 || e.status === 403) this.logout();
      else alert('No se pudo exportar: ' + e.message);
    }
  }

  // ---------- Cámara ----------
  async iniciarCamara() {
    const msg = $('mensajeCamara');
    try {
      $('encenderCamara').disabled = true;
      msg.textContent = 'Conectando cámara...';
      await this.camera.encender();
      $('video').style.display = 'block';
      msg.style.display = 'none';
      $('guiaFacialOverlay').style.display = 'block';
      $('apagarCamara').disabled = false;
      this.iniciarBucleAnalisis();
    } catch (err) {
      msg.style.display = 'block';
      msg.textContent = err.message;
      $('encenderCamara').disabled = false;
      $('apagarCamara').disabled = true;
    }
  }

  apagarCamara() {
    this.detenerBucleAnalisis();
    this.camera.detener();
    $('video').style.display = 'none';
    $('guiaFacialOverlay').style.display = 'none';
    $('mensajeCamara').style.display = 'block';
    $('mensajeCamara').textContent = 'La cámara está apagada.';
    $('encenderCamara').disabled = false;
    $('apagarCamara').disabled = true;
    this.ui.ocultarCardReto();
  }

  // ---------- Solicitud y documento ----------
  procesarArchivoDocumento(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Selecciona una imagen válida (JPG, PNG).');
    if (file.size > 8 * 1024 * 1024) return alert('La imagen excede 8 MB.');
    const reader = new FileReader();
    reader.onload = (e) => {
      this.documentoBase64 = e.target.result;
      $('docPreviewImg').src = this.documentoBase64;
      $('docPreviewContainer').style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  async crearSolicitud(e) {
    e.preventDefault();
    if (!this.documentoBase64) return alert('Carga primero la fotografía de tu documento.');
    const btn = $('btnCrearSolicitud');
    const nombre = $('inputNombre').value.trim();
    const numDoc = $('inputNumDoc').value.trim();
    const tipo = $('selectTipoDoc').value;
    try {
      btn.disabled = true;
      btn.textContent = 'Analizando documento...';
      const docFace = await this.faceAi.detectarYExtraer(this.documentoBase64);
      const embeddingDoc = docFace?.detectado ? docFace.descriptor128 : null;

      btn.textContent = 'Registrando solicitud...';
      const sol = await this.api.crearSolicitud(nombre, numDoc, tipo, $('chkConsentimiento').checked);
      await this.api.cargarDocumento(sol.codigoSolicitud, this.documentoBase64, tipo, numDoc, embeddingDoc);
      this.solicitudActual = sol;
      $('solicitudActivaCodigo').textContent = sol.codigoSolicitud;
      $('paso1Container').style.display = 'none';
      $('paso2Container').style.display = 'block';
      await this.iniciarCamara();
    } catch (err) {
      alert('No se pudo registrar la solicitud: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Continuar a Verificación';
    }
  }

  cerrarResultado() {
    this.ui.cerrarModal();
    if (this.ultimoResultado?.estado === 'EN_PROCESO' && (this.ultimoResultado?.intentosRestantes ?? 0) > 0) {
      this.retosAsignados = [];
      this.indiceRetoActual = 0;
      this.respuestasRetos = [];
      this.enTransicionReto = false;
      $('btnIniciarPrueba').disabled = false;
      return;
    }
    this.apagarCamara();
    this.reset();
    $('paso2Container').style.display = 'none';
    $('paso1Container').style.display = 'block';
    $('btnIniciarPrueba').disabled = false;
  }

  // ---------- Retos de vida ----------
  async iniciarSecuenciaPruebaDeVida() {
    if (!this.camera.isStreaming) return alert('Enciende la cámara primero.');
    const btn = $('btnIniciarPrueba');
    btn.disabled = true;
    this.liveness.reset();
    this.resetTelemetria();
    this.respuestasRetos = [];
    this.rostroCapturaBase64 = null;
    this.enTransicionReto = false;
    this.ultimoLandmarksAI = null;
    this.tiempoInicioPrueba = Date.now();
    try {
      const data = await this.api.obtenerRetos(this.solicitudActual.codigoSolicitud);
      this.retosAsignados = data.retosAsignados;
      this.indiceRetoActual = 0;
      this.ejecutarRetoActual();
    } catch (err) {
      alert('No se pudieron obtener los retos: ' + err.message);
      btn.disabled = false;
    }
  }

  ejecutarRetoActual() {
    this.enTransicionReto = false;
    if (this.indiceRetoActual >= this.retosAsignados.length) return this.finalizarPruebaDeVida();
    const reto = this.retosAsignados[this.indiceRetoActual];
    this.liveness.reset(); // contadores por reto (p.ej. parpadeos) desde cero
    this.ui.mostrarCardReto(reto, this.indiceRetoActual, this.retosAsignados.length);
    let seg = reto.tiempoSegundos;
    this.ui.actualizarTimerReto(seg, reto.tiempoSegundos);
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      seg--;
      this.ui.actualizarTimerReto(seg, reto.tiempoSegundos);
      if (seg <= 0) {
        clearInterval(this.timerInterval);
        this.registrarReto(reto, false, 0.2);
        this.indiceRetoActual++;
        this.ejecutarRetoActual();
      }
    }, 1000);
  }

  registrarReto(reto, cumplido, score) {
    this.respuestasRetos.push({ retoId: reto.id, codigoReto: reto.codigoReto, cumplido, scoreCumplimiento: score });
  }

  iniciarBucleAnalisis() {
    this.detenerBucleAnalisis();
    let ultimo = 0;
    let ultimoAI = 0;
    const loop = (t) => {
      this.loopAnalisisId = requestAnimationFrame(loop);
      if (t - ultimo < 66) return; // ~15 análisis/s, suficiente y ligero
      ultimo = t;
      const img = this.camera.isStreaming ? this.camera.obtenerImageData() : null;
      if (!img) return;

      const luz = this.liveness.analizarCalidadYEncuadre(img);
      this.ui.actualizarIndicadorLuz(luz.brillo, luz.iluminacionOptima, luz.mensaje);
      const mov = this.liveness.calcularDiferenciaFotogramas(img);
      this.ui.actualizarIndicadorMovimiento(mov.deltaMovimiento, mov.esEstatico, mov.esErratico);

      const enPrueba = !this.enTransicionReto && this.retosAsignados.length > 0 && this.indiceRetoActual < this.retosAsignados.length;
      if (enPrueba) {
        if (this.faceAi.cargado && !this.procesandoLandmarksAI && (t - ultimoAI >= 160)) {
          ultimoAI = t;
          this.procesandoLandmarksAI = true;
          this.faceAi.analizarVideo($('video'))
            .then((res) => { if (res) this.ultimoLandmarksAI = res; })
            .finally(() => { this.procesandoLandmarksAI = false; });
        }

        this.tel.frames++;
        this.tel.sumaDelta += mov.deltaMovimiento;
        if (mov.esEstatico) this.tel.framesEstaticos++;
        else if (!mov.esErratico && mov.deltaMovimiento > 0.004) this.tel.framesMovimientoHumano++;

        const reto = this.retosAsignados[this.indiceRetoActual];
        const ev = this.liveness.evaluarReto(reto.codigoReto, img, mov, this.ultimoLandmarksAI);
        $('retoFeedbackTiempoReal').textContent = ev.feedback;
        if (ev.cumplido) {
          this.enTransicionReto = true;
          clearInterval(this.timerInterval);
          this.registrarReto(reto, true, 1.0);
          this.rostroCapturaBase64 = this.camera.capturarFrameBase64('image/jpeg', 0.9);
          this.indiceRetoActual++;
          setTimeout(() => this.ejecutarRetoActual(), 800);
        }
      }
    };
    this.loopAnalisisId = requestAnimationFrame(loop);
  }

  detenerBucleAnalisis() {
    if (this.loopAnalisisId) cancelAnimationFrame(this.loopAnalisisId);
    this.loopAnalisisId = null;
    clearInterval(this.timerInterval);
    this.timerInterval = null;
  }

  async finalizarPruebaDeVida() {
    this.ui.ocultarCardReto();
    clearInterval(this.timerInterval);
    const duracion = (Date.now() - this.tiempoInicioPrueba) / 1000;
    if (!this.rostroCapturaBase64) this.rostroCapturaBase64 = this.camera.capturarFrameBase64('image/jpeg', 0.9);

    const liveFace = await this.faceAi.detectarYExtraer(this.rostroCapturaBase64);
    const t = this.tel;
    const scoreCliente = t.frames ? t.framesMovimientoHumano / t.frames : 0;
    const payload = {
      codigoSolicitud: this.solicitudActual.codigoSolicitud,
      rostroCapturadoBase64: this.rostroCapturaBase64,
      embeddingFacial: liveFace?.detectado ? liveFace.descriptor128 : null,
      respuestasRetos: this.respuestasRetos,
      scoreLivenessFrontend: Math.min(1, scoreCliente * 2), // 50% de frames con movimiento humano => 1.0
      movimientoPromedio: t.frames ? t.sumaDelta / t.frames : 0,
      estaticoDetectado: t.frames > 20 && t.framesEstaticos / t.frames > 0.6,
      duracionSegundos: duracion,
      dispositivoUserAgent: navigator.userAgent
    };

    try {
      const resultado = await this.api.enviarIntentoVerificacion(payload);
      this.ultimoResultado = resultado;
      this.ui.mostrarResultadoModal(resultado);
      if (this.api.token) this.cargarAdmin();
    } catch (err) {
      alert('Error al evaluar la prueba de vida: ' + err.message);
      $('btnIniciarPrueba').disabled = false;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new AppController(); });

/**
 * Orquestador principal del frontend.
 * Sin datos simulados: si el backend falla, se muestra el error real al usuario.
 */
import { ApiService } from './api.js';
import { CameraService } from './camera.js';
import { LivenessEngine } from './liveness.js';
import { UIManager } from './ui.js';

const $ = (id) => document.getElementById(id);

class AppController {
  constructor() {
    this.api = new ApiService();
    this.liveness = new LivenessEngine();
    this.ui = new UIManager();
    this.camera = null;
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
    this.resetTelemetria();
  }

  resetTelemetria() {
    this.tel = { frames: 0, framesMovimientoHumano: 0, framesEstaticos: 0, sumaDelta: 0 };
  }

  init() {
    const compat = CameraService.verificarCompatibilidad();
    const banner = $('bannerCompatibilidad');
    if (banner) {
      banner.textContent = compat.mensaje;
      banner.className = compat.compatible ? 'banner-info' : 'banner-danger';
    }
    this.camera = new CameraService($('video'), $('canvasCaptura'));
    this.bindEvents();
    this.actualizarSesion();
  }

  bindEvents() {
    $('encenderCamara')?.addEventListener('click', () => this.iniciarCamara());
    $('apagarCamara')?.addEventListener('click', () => this.apagarCamara());
    $('inputDocumento')?.addEventListener('change', (e) => this.procesarArchivoDocumento(e));
    $('formNuevaSolicitud')?.addEventListener('submit', (e) => this.crearSolicitud(e));
    $('btnIniciarPrueba')?.addEventListener('click', () => this.iniciarSecuenciaPruebaDeVida());
    $('btnCerrarModal')?.addEventListener('click', () => this.cerrarResultado());
    $('formLogin')?.addEventListener('submit', (e) => this.login(e));
    $('btnLogout')?.addEventListener('click', () => this.logout());
    $('btnExportarCsv')?.addEventListener('click', () => this.exportarCsv());
    $('filtroEstado')?.addEventListener('change', () => this.cargarAdmin());

    document.querySelectorAll('nav a').forEach((link) => {
      link.addEventListener('click', () => {
        const h = link.getAttribute('href');
        if (['#historial', '#usuarios', '#reportes'].includes(h)) this.cargarAdmin();
      });
    });
  }

  // ---------- Sesión administrativa ----------
  actualizarSesion() {
    const logged = !!this.api.token;
    $('formLogin').style.display = logged ? 'none' : 'flex';
    $('btnLogout').style.display = logged ? 'inline-flex' : 'none';
    $('estadoSesion').textContent = logged ? `Sesión: ${localStorage.getItem('liveness_user') || 'administrador'}` : 'Acceso administrativo';
  }

  async login(e) {
    e.preventDefault();
    try {
      const res = await this.api.login($('loginEmail').value.trim(), $('loginPassword').value);
      localStorage.setItem('liveness_user', res.usuarioNombre || '');
      $('loginPassword').value = '';
      this.actualizarSesion();
      this.cargarAdmin();
    } catch (err) {
      alert('No se pudo iniciar sesión: ' + err.message);
    }
  }

  logout() {
    this.api.setToken(null);
    localStorage.removeItem('liveness_user');
    this.actualizarSesion();
    this.cargarAdmin();
  }

  mensajeSinSesion(tbodyId, cols) {
    const tb = $(tbodyId);
    if (tb) tb.innerHTML = `<tr><td colspan="${cols}" style="text-align:center">Inicia sesión como administrador u oficial para ver estos datos.</td></tr>`;
  }

  async cargarAdmin() {
    if (!this.api.token) {
      this.mensajeSinSesion('tablaHistorialBody', 6);
      this.mensajeSinSesion('tablaAdminBody', 7);
      this.mensajeSinSesion('tablaUsuariosBody', 5);
      return;
    }
    try {
      const estado = $('filtroEstado')?.value;
      const data = await this.api.obtenerVerificacionesAdmin({ estado });
      this.ui.renderizarTablaHistorial(data.items);
      this.ui.renderizarTablaAdmin(data.items);
      this.ui.renderizarMetricas(await this.api.obtenerMetricas());
      this.renderUsuarios(await this.api.obtenerUsuariosAdmin());
    } catch (err) {
      if (/401|403/.test(err.message)) { this.logout(); }
      else alert('Error al cargar datos: ' + err.message);
    }
  }

  renderUsuarios(users) {
    const tb = $('tablaUsuariosBody');
    if (!tb) return;
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    tb.innerHTML = users.map((u) => `<tr><td>${u.id}</td><td>${esc(u.nombreCompleto)}</td><td>${esc(u.email)}</td><td>${esc(u.rol)}</td><td>${u.activo ? 'Activo' : 'Inactivo'}</td></tr>`).join('');
  }

  exportarCsv() {
    try {
      const items = JSON.parse(localStorage.getItem('liveness_solicitudes') || '[]');
      let csv = 'CodigoSolicitud,NombrePersona,NumeroDocumento,TipoDocumento,Estado,ScoreLiveness,ScoreSimilitud,FechaCreacion\n';
      items.forEach((s) => {
        csv += `"${s.codigoSolicitud}","${s.nombrePersona}","${s.numeroDocumento}","${s.tipoDocumento}","${s.estado}",${s.scoreLivenessGlobal},${s.scoreSimilitudFacial},"${s.fechaCreacion}"\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Reporte_Verificaciones_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert('No se pudo exportar: ' + e.message);
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
      btn.textContent = 'Registrando solicitud...';
      const sol = await this.api.crearSolicitud(nombre, numDoc, tipo, $('chkConsentimiento').checked);
      await this.api.cargarDocumento(sol.codigoSolicitud, this.documentoBase64, tipo, numDoc);
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

      const enPrueba = this.retosAsignados.length > 0 && this.indiceRetoActual < this.retosAsignados.length;
      if (enPrueba) {
        this.tel.frames++;
        this.tel.sumaDelta += mov.deltaMovimiento;
        if (mov.esEstatico) this.tel.framesEstaticos++;
        else if (!mov.esErratico && mov.deltaMovimiento > 0.004) this.tel.framesMovimientoHumano++;

        const reto = this.retosAsignados[this.indiceRetoActual];
        const ev = this.liveness.evaluarReto(reto.codigoReto, img);
        $('retoFeedbackTiempoReal').textContent = ev.feedback;
        if (ev.cumplido) {
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

    const t = this.tel;
    const scoreCliente = t.frames ? t.framesMovimientoHumano / t.frames : 0;
    const payload = {
      codigoSolicitud: this.solicitudActual.codigoSolicitud,
      rostroCapturadoBase64: this.rostroCapturaBase64,
      respuestasRetos: this.respuestasRetos,
      scoreLivenessFrontend: Math.min(1, scoreCliente * 2), // 50% de frames con movimiento humano => 1.0
      movimientoPromedio: t.frames ? t.sumaDelta / t.frames : 0,
      estaticoDetectado: t.frames > 20 && t.framesEstaticos / t.frames > 0.6,
      duracionSegundos: duracion,
      dispositivoUserAgent: navigator.userAgent
    };

    try {
      const resultado = await this.api.enviarIntentoVerificacion(payload);
      this.ui.mostrarResultadoModal(resultado);
      if (this.api.token) this.cargarAdmin();
    } catch (err) {
      alert('Error al evaluar la prueba de vida: ' + err.message);
      $('btnIniciarPrueba').disabled = false;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new AppController(); });

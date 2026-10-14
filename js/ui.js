/**
 * Módulo de Interfaz de Usuario y Renderizado Dinámico
 * Sistema de Pruebas de Vida - Grupo 4 (CASATIC / UGB)
 */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class UIManager {
  constructor() {
    this.navLinks = document.querySelectorAll('nav a');
    this.sections = document.querySelectorAll('main section');
    this.initNavigation();
  }

  initNavigation() {
    this.navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').replace('#', '');
        this.mostrarSeccion(targetId);
      });
    });
  }

  mostrarSeccion(seccionId) {
    this.sections.forEach(sec => {
      sec.classList.toggle('seccion-activa', sec.id === seccionId);
    });

    this.navLinks.forEach(link => {
      const match = link.getAttribute('href') === `#${seccionId}`;
      link.classList.toggle('nav-activo', match);
    });

    window.location.hash = seccionId;
  }

  actualizarIndicadorLuz(brillo, optimo, mensaje) {
    const meter = document.getElementById('meterLuz');
    const label = document.getElementById('labelLuz');
    if (meter) {
      meter.value = brillo;
      meter.className = optimo ? 'meter-ok' : 'meter-warn';
    }
    if (label) {
      label.textContent = `${mensaje} (${brillo}%)`;
      label.style.color = optimo ? '#1b5e20' : '#c62828';
    }
  }

  actualizarIndicadorMovimiento(delta, esEstatico, esErratico) {
    const badge = document.getElementById('badgeMovimiento');
    if (!badge) return;

    if (esEstatico) {
      badge.textContent = "Alerta: Imagen estática (Sospecha Foto)";
      badge.className = "badge-alerta badge-danger";
    } else if (esErratico) {
      badge.textContent = "Alerta: Movimiento brusco / cámara inestable";
      badge.className = "badge-alerta badge-warn";
    } else {
      badge.textContent = "Micro-movimiento humano detectado ✓";
      badge.className = "badge-alerta badge-success";
    }
  }

  mostrarCardReto(reto, index, total) {
    const contenedor = document.getElementById('cardRetoActivo');
    const titulo = document.getElementById('retoTitulo');
    const instruccion = document.getElementById('retoInstruccion');
    const badge = document.getElementById('retoNumero');

    if (contenedor) contenedor.style.display = 'block';
    if (titulo) titulo.textContent = reto.nombreReto;
    if (instruccion) instruccion.textContent = reto.instruccion;
    if (badge) badge.textContent = `Reto ${index + 1} de ${total}`;
  }

  ocultarCardReto() {
    const contenedor = document.getElementById('cardRetoActivo');
    if (contenedor) contenedor.style.display = 'none';
  }

  actualizarTimerReto(segundosRestantes, segundosTotales) {
    const bar = document.getElementById('timerBar');
    const label = document.getElementById('timerLabel');
    if (bar) {
      const pct = (segundosRestantes / segundosTotales) * 100;
      bar.style.width = `${pct}%`;
      bar.style.backgroundColor = pct < 25 ? '#d32f2f' : '#245a93';
    }
    if (label) {
      label.textContent = `${segundosRestantes}s`;
    }
  }

  mostrarResultadoModal(resultado) {
    const modal = document.getElementById('modalResultado');
    const titulo = document.getElementById('modalTitulo');
    const mensaje = document.getElementById('modalMensaje');
    const scoreLiveness = document.getElementById('modalScoreLiveness');
    const scoreSimilitud = document.getElementById('modalScoreSimilitud');
    const estadoBadge = document.getElementById('modalEstadoBadge');

    if (!modal) return;

    titulo.textContent = resultado.estado === 'APROBADO' ? '¡Verificación Exitosa!' : 'Resultado de Verificación';
    mensaje.textContent = resultado.mensaje;

    scoreLiveness.textContent = `${Math.round(resultado.scoreLiveness * 100)}%`;
    scoreSimilitud.textContent = `${Math.round(resultado.scoreSimilitudFacial * 100)}%`;

    estadoBadge.textContent = resultado.estado;
    estadoBadge.className = `badge-estado estado-${resultado.estado.toLowerCase()}`;

    modal.style.display = 'flex';
  }

  cerrarModal() {
    const modal = document.getElementById('modalResultado');
    if (modal) modal.style.display = 'none';
  }

  renderizarTablaHistorial(items) {
    const tbody = document.getElementById('tablaHistorialBody');
    if (!tbody) return;

    if (!items || items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center">No hay registros de verificaciones previas.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(item => `
      <tr>
        <td><code>${esc(item.codigoSolicitud || item.id)}</code></td>
        <td><strong>${esc(item.nombrePersona || 'Usuario')}</strong></td>
        <td>${esc(item.tipoDocumento)}: ${esc(item.numeroDocumento)}</td>
        <td>
          <span class="badge-estado estado-${(item.estado || '').toLowerCase()}">
            ${esc(item.estado)}
          </span>
        </td>
        <td>Liveness: ${(item.scoreLivenessGlobal * 100).toFixed(0)}% | Similitud: ${(item.scoreSimilitudFacial * 100).toFixed(0)}%</td>
        <td>${new Date(item.fechaCreacion).toLocaleString()}</td>
      </tr>
    `).join('');
  }

  renderizarMetricas(metricas) {
    const map = {
      'statTotal': metricas.totalSolicitudes,
      'statAprobadas': metricas.solicitudesAprobadas,
      'statRechazadas': metricas.solicitudesRechazadas,
      'statManual': metricas.solicitudesRevisionManual,
      'statTasaExito': `${metricas.tasaExitoPorcentaje}%`,
      'statTiempoProm': `${metricas.tiempoPromedioVerificacionSegundos}s`
    };

    for (const [id, val] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) el.textContent = val !== undefined ? val : '-';
    }
  }

  renderizarTablaAdmin(items) {
    const tbody = document.getElementById('tablaAdminBody');
    if (!tbody) return;

    if (!items || items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center">No se encontraron verificaciones con los filtros seleccionados.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(s => `
      <tr>
        <td><code>${esc(s.codigoSolicitud)}</code></td>
        <td>${esc(s.nombrePersona)}</td>
        <td>${esc(s.tipoDocumento)} ${esc(s.numeroDocumento)}</td>
        <td>
          <span class="badge-estado estado-${s.estado.toLowerCase()}">${esc(s.estado)}</span>
        </td>
        <td>${(s.scoreSimilitudFacial * 100).toFixed(1)}%</td>
        <td>${(s.scoreLivenessGlobal * 100).toFixed(1)}%</td>
        <td>${new Date(s.fechaCreacion).toLocaleString()}</td>
      </tr>
    `).join('');
  }
}

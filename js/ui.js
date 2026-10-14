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
    // Escucha cualquier enlace con href="#seccion" (incluyendo el botón de inicio)
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#') && href.length > 1) {
          e.preventDefault();
          const targetId = href.substring(1);
          this.mostrarSeccion(targetId);
        }
      });
    });

    // Soporte para cambios directos de URL / botones de historial del navegador
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && document.getElementById(hash)) {
        this.mostrarSeccion(hash);
      }
    });

    // Detectar hash inicial al cargar
    const initialHash = window.location.hash.replace('#', '');
    if (initialHash && document.getElementById(initialHash)) {
      this.mostrarSeccion(initialHash);
    }
  }

  mostrarSeccion(seccionId) {
    this.sections.forEach(sec => {
      sec.classList.toggle('seccion-activa', sec.id === seccionId);
    });

    this.navLinks.forEach(link => {
      const match = link.getAttribute('href') === `#${seccionId}`;
      link.classList.toggle('nav-activo', match);
    });

    if (window.location.hash !== `#${seccionId}`) {
      window.location.hash = seccionId;
    }

    // Scroll suave hacia la sección en móvil
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      bar.style.backgroundColor = pct < 25 ? '#dc2626' : '#194e82';
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

  // Renderiza el apartado de casos en revisión manual
  renderizarCasosRevisionManual(items, onAbrirRevision) {
    const contenedor = document.getElementById('contenedorCasosManuales');
    const badgeConteo = document.getElementById('badgeConteoManual');
    if (!contenedor) return;

    const manuales = (items || []).filter(item => item.estado === 'REVISION_MANUAL');

    if (badgeConteo) {
      badgeConteo.textContent = `${manuales.length} pendiente${manuales.length === 1 ? '' : 's'}`;
      badgeConteo.style.backgroundColor = manuales.length > 0 ? '#fef3c7' : '#dcfce7';
      badgeConteo.style.color = manuales.length > 0 ? '#92400e' : '#166534';
    }

    if (manuales.length === 0) {
      contenedor.innerHTML = `
        <div class="caso-manual-vacio">
          <span>✓</span> No hay solicitudes pendientes de revisión manual. Todas las verificaciones han sido procesadas.
        </div>
      `;
      return;
    }

    contenedor.innerHTML = manuales.map(caso => `
      <div class="caso-manual-card">
        <div class="caso-manual-info">
          <div class="caso-manual-header-row">
            <strong>${esc(caso.nombrePersona)}</strong>
            <span class="badge-estado estado-revision_manual">Zona Gris</span>
          </div>
          <div class="caso-manual-meta">
            <span>Doc: ${esc(caso.tipoDocumento)} ${esc(caso.numeroDocumento)}</span>
            <span>Código: <code>${esc(caso.codigoSolicitud)}</code></span>
          </div>
          <div class="caso-manual-scores">
            <span>Similitud: <strong>${Math.round(caso.scoreSimilitudFacial * 100)}%</strong></span>
            <span>Liveness: <strong>${Math.round(caso.scoreLivenessGlobal * 100)}%</strong></span>
          </div>
        </div>
        <button type="button" class="btn-primary btn-sm btn-abrir-revision" data-codigo="${esc(caso.codigoSolicitud)}">
          Revisar y Decidir
        </button>
      </div>
    `).join('');

    // Asignar eventos de click a cada botón de revisión
    contenedor.querySelectorAll('.btn-abrir-revision').forEach(btn => {
      btn.addEventListener('click', () => {
        const codigo = btn.getAttribute('data-codigo');
        const caso = manuales.find(c => c.codigoSolicitud === codigo);
        if (caso && onAbrirRevision) {
          onAbrirRevision(caso);
        }
      });
    });
  }

  renderizarTablaHistorial(items, onAbrirRevision) {
    const tbody = document.getElementById('tablaHistorialBody');
    if (!tbody) return;

    if (!items || items.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center">No hay registros de verificaciones previas.</td></tr>`;
      return;
    }

    tbody.innerHTML = items.map(item => {
      const esManual = item.estado === 'REVISION_MANUAL';
      return `
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
          <td>
            ${esManual ? `
              <button type="button" class="btn-primary btn-sm btn-tabla-revisar" data-codigo="${esc(item.codigoSolicitud)}" style="padding:4px 8px; font-size:11px;">
                Revisar
              </button>
            ` : `<span style="color:#94a3b8; font-size:12px;">Completado</span>`}
          </td>
        </tr>
      `;
    }).join('');

    // Vincular botones de la tabla
    tbody.querySelectorAll('.btn-tabla-revisar').forEach(btn => {
      btn.addEventListener('click', () => {
        const codigo = btn.getAttribute('data-codigo');
        const caso = items.find(c => c.codigoSolicitud === codigo);
        if (caso && onAbrirRevision) {
          onAbrirRevision(caso);
        }
      });
    });
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

  // Modal de Decisión de Revisión Manual
  abrirModalRevisionManual(caso, onGuardarDecision) {
    const modal = document.getElementById('modalRevisionManual');
    if (!modal) return;

    document.getElementById('manualCasoNombre').textContent = caso.nombrePersona;
    document.getElementById('manualCasoDoc').textContent = `${caso.tipoDocumento} ${caso.numeroDocumento}`;
    document.getElementById('manualCasoCodigo').textContent = caso.codigoSolicitud;
    document.getElementById('manualCasoLiveness').textContent = `${Math.round(caso.scoreLivenessGlobal * 100)}%`;
    document.getElementById('manualCasoSimilitud').textContent = `${Math.round(caso.scoreSimilitudFacial * 100)}%`;

    const selectMotivo = document.getElementById('selectMotivoManual');
    const inputObs = document.getElementById('inputObservacionManual');
    inputObs.value = '';

    const actualizarMotivos = (decision) => {
      let opciones = [];
      if (decision === 'APROBAR') {
        opciones = [
          'Rasgos fisonómicos concordantes con el documento',
          'Documento legible y prueba de vida satisfactoria',
          'Variación leve atribuible a edad o iluminación',
          'Aprobación autorizada por excepción'
        ];
      } else if (decision === 'RECHAZAR') {
        opciones = [
          'Discrepancia fisonómica no coincidente con el documento',
          'Fotografía del documento ilegible o de baja calidad',
          'Sospecha de documento alterado o inconsistente',
          'No se pudo certificar identidad de forma concluyente'
        ];
      } else {
        opciones = [
          'Solicitar reintento por iluminación deficiente',
          'Solicitar reintento por posición o ángulo inadecuado',
          'Solicitar reintento por movimiento de cámara durante la prueba'
        ];
      }

      selectMotivo.innerHTML = opciones.map(m => `<option value="${m}">${m}</option>`).join('');
    };

    // Inicializar motivos para la opción seleccionada
    const radios = modal.querySelectorAll('input[name="decisionOpcion"]');
    radios.forEach(radio => {
      if (radio.checked) actualizarMotivos(radio.value);
      radio.onchange = () => actualizarMotivos(radio.value);
    });

    const form = document.getElementById('formDecisionManual');
    form.onsubmit = (e) => {
      e.preventDefault();
      const decisionSeleccionada = modal.querySelector('input[name="decisionOpcion"]:checked').value;
      const motivo = selectMotivo.value;
      const obs = inputObs.value.trim();
      if (onGuardarDecision) {
        onGuardarDecision(caso.codigoSolicitud, decisionSeleccionada, motivo, obs);
      }
      modal.style.display = 'none';
    };

    modal.style.display = 'flex';
  }

  cerrarModalRevisionManual() {
    const modal = document.getElementById('modalRevisionManual');
    if (modal) modal.style.display = 'none';
  }
}

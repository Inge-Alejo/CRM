// ================================================================
// CRM & WHATSAPP CHATBOT - EXECUTIVE DASHBOARD LOGIC (UDEA MEDICINA)
// Multi-Asesor, Segmentación IA en Tiempo Real & Portafolio con Fechas
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Navegación Sidebar
  const navItems = document.querySelectorAll('.nav-item');
  const viewPanels = document.querySelectorAll('.view-panel');
  const currentViewTitle = document.getElementById('currentViewTitle');
  const currentViewSubtitle = document.getElementById('currentViewSubtitle');
  const btnGlobalRefresh = document.getElementById('btnGlobalRefresh');

  // Badges y Alertas
  const leadsAlertBadge = document.getElementById('leadsAlertBadge');
  const coursesNavBadge = document.getElementById('coursesNavBadge');
  const dashAlertBanner = document.getElementById('dashAlertBanner');
  const dashAlertMessage = document.getElementById('dashAlertMessage');

  // Topbar Quota & Asesor Activo
  const quotaCount = document.getElementById('quotaCount');
  const activeAdvisorSelect = document.getElementById('activeAdvisorSelect');

  // KPIs Overview
  const kpiTotalLeads = document.getElementById('kpiTotalLeads');
  const kpiAdvisorPending = document.getElementById('kpiAdvisorPending');
  const kpiAdvisorFooter = document.getElementById('kpiAdvisorFooter');
  const kpiAiResolution = document.getElementById('kpiAiResolution');
  const kpiTotalPrograms = document.getElementById('kpiTotalPrograms');
  const overviewLeadsTableBody = document.getElementById('overviewLeadsTableBody');

  // CRM Leads View
  const leadsTableBody = document.getElementById('leadsTableBody');
  const crmFilterSelect = document.getElementById('crmFilterSelect');
  const crmAdvisorFilter = document.getElementById('crmAdvisorFilter');
  const crmTempFilter = document.getElementById('crmTempFilter');
  const crmSearchInput = document.getElementById('crmSearchInput');
  const btnRefreshLeads = document.getElementById('btnRefreshLeads');

  // Segmentación View
  const kpiSegTotal = document.getElementById('kpiSegTotal');
  const kpiSegHot = document.getElementById('kpiSegHot');
  const kpiSegMedicos = document.getElementById('kpiSegMedicos');
  const kpiSegSalud = document.getElementById('kpiSegSalud');
  const segProfessionBars = document.getElementById('segProfessionBars');
  const segTemperatureBars = document.getElementById('segTemperatureBars');
  const segFilterProfSelect = document.getElementById('segFilterProfSelect');
  const segFilterTempSelect = document.getElementById('segFilterTempSelect');
  const segTableBody = document.getElementById('segTableBody');
  const btnRefreshSegmentation = document.getElementById('btnRefreshSegmentation');

  // Simulador
  const simulatorForm = document.getElementById('simulatorForm');
  const simPhoneInput = document.getElementById('simPhoneInput');
  const simMessageInput = document.getElementById('simMessageInput');
  const chatWindow = document.getElementById('chatWindow');
  const quickPromptButtons = document.querySelectorAll('.quick-prompt-btn');
  const simFeedback = document.getElementById('simFeedback');

  // Portafolio & Sincronización
  const btnSyncWeb = document.getElementById('btnSyncWeb');
  const syncStatusAlert = document.getElementById('syncStatusAlert');
  const portfolioGrid = document.getElementById('portfolioGrid');
  const portfolioFilterCategory = document.getElementById('portfolioFilterCategory');
  const btnOpenNewCourseModal = document.getElementById('btnOpenNewCourseModal');
  const courseModal = document.getElementById('courseModal');
  const btnCloseCourseModal = document.getElementById('btnCloseCourseModal');
  const newCourseForm = document.getElementById('newCourseForm');

  // Modales
  const chatModal = document.getElementById('chatModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const modalChatTitle = document.getElementById('modalChatTitle');
  const modalChatBody = document.getElementById('modalChatBody');
  const modalChatFooter = document.getElementById('modalChatFooter');
  const modalAdvisorSelect = document.getElementById('modalAdvisorSelect');
  const btnModalTakeCase = document.getElementById('btnModalTakeCase');
  const btnModalMarkAttended = document.getElementById('btnModalMarkAttended');
  const modalAttendedByBadge = document.getElementById('modalAttendedByBadge');
  const modalNotesInput = document.getElementById('modalNotesInput');
  const btnSaveNotes = document.getElementById('btnSaveNotes');

  // Auth & Perfil Asesor
  const topbarAdvisorName = document.getElementById('topbarAdvisorName');
  const topbarAdvisorAvatar = document.getElementById('topbarAdvisorAvatar');
  const btnOpenLoginModal = document.getElementById('btnOpenLoginModal');
  const advisorLoginModal = document.getElementById('advisorLoginModal');
  const btnCloseLoginModal = document.getElementById('btnCloseLoginModal');
  const quickAdvisorGrid = document.getElementById('quickAdvisorGrid');
  const formAdvisorLogin = document.getElementById('formAdvisorLogin');
  const loginEmailInput = document.getElementById('loginEmailInput');
  const loginPasswordInput = document.getElementById('loginPasswordInput');
  const loginErrorAlert = document.getElementById('loginErrorAlert');

  let allLoadedLeads = [];
  let allPortfolioItems = [];
  let currentActivePhone = null;

  // Lista de asesores autorizados de la Facultad de Medicina UdeA
  const UDEA_ADVISORS = [
    { name: 'Dra. Carolina Martínez', role: 'Asesora Posgrados y Diplomados', email: 'carolina.martinez@udea.edu.co', initials: 'CM' },
    { name: 'Dr. Alejandro Restrepo', role: 'Asesor Educación Continua', email: 'alejandro.restrepo@udea.edu.co', initials: 'AR' },
    { name: 'Enf. Marcela Gómez', role: 'Asesora Cursos Clínicos y Talleres', email: 'marcela.gomez@udea.edu.co', initials: 'MG' },
    { name: 'Lic. David Builes', role: 'Asesor Admisiones e Inscripciones', email: 'david.builes@udea.edu.co', initials: 'DB' }
  ];

  // Estado de sesión del Asesor
  let currentAdvisorUser = JSON.parse(localStorage.getItem('udea_advisor_user') || 'null') || {
    name: 'Dra. Carolina Martínez',
    email: 'carolina.martinez@udea.edu.co',
    role: 'Asesora Posgrados y Diplomados',
    initials: 'CM'
  };

  function updateAdvisorUI(adv) {
    if (!adv) return;
    currentAdvisorUser = adv;
    localStorage.setItem('udea_advisor_user', JSON.stringify(adv));
    localStorage.setItem('udea_active_advisor', adv.name);

    if (topbarAdvisorName) topbarAdvisorName.textContent = adv.name;
    if (topbarAdvisorAvatar) {
      const ini = adv.initials || adv.name.split(' ').map(n => n[0]).slice(0, 2).join('');
      topbarAdvisorAvatar.textContent = ini;
    }
    if (activeAdvisorSelect) activeAdvisorSelect.value = adv.name;
  }

  function getActiveAdvisor() {
    return currentAdvisorUser ? currentAdvisorUser.name : (localStorage.getItem('udea_active_advisor') || 'Dra. Carolina Martínez');
  }

  // Renderizar chips de selección rápida en modal de Login
  function renderQuickAdvisorGrid() {
    if (!quickAdvisorGrid) return;
    quickAdvisorGrid.innerHTML = UDEA_ADVISORS.map(adv => `
      <div class="quick-adv-chip ${currentAdvisorUser && currentAdvisorUser.email === adv.email ? 'active' : ''}" 
           data-email="${adv.email}" data-name="${adv.name}">
        <div class="adv-chip-avatar">${adv.initials}</div>
        <div class="adv-chip-meta">
          <span class="adv-chip-name">${adv.name}</span>
          <span class="adv-chip-role">${adv.role}</span>
        </div>
      </div>
    `).join('');

    quickAdvisorGrid.querySelectorAll('.quick-adv-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const email = chip.dataset.email;
        if (loginEmailInput) loginEmailInput.value = email;
        if (loginPasswordInput) loginPasswordInput.value = 'UdeA2026*';
        if (loginErrorAlert) loginErrorAlert.style.display = 'none';
        quickAdvisorGrid.querySelectorAll('.quick-adv-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });
  }

  // Login handler
  async function performLogin(email, password) {
    try {
      if (loginErrorAlert) loginErrorAlert.style.display = 'none';
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!data.success) {
        if (loginErrorAlert) {
          loginErrorAlert.textContent = data.error || 'Credenciales inválidas.';
          loginErrorAlert.style.display = 'block';
        }
        return false;
      }

      localStorage.setItem('udea_auth_token', data.token);
      updateAdvisorUI(data.advisor);
      if (advisorLoginModal) advisorLoginModal.style.display = 'none';
      return true;
    } catch (err) {
      if (loginErrorAlert) {
        loginErrorAlert.textContent = 'Error de conexión: ' + err.message;
        loginErrorAlert.style.display = 'block';
      }
      return false;
    }
  }

  if (formAdvisorLogin) {
    formAdvisorLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginEmailInput ? loginEmailInput.value.trim() : '';
      const password = loginPasswordInput ? loginPasswordInput.value.trim() : '';
      await performLogin(email, password);
    });
  }

  if (btnOpenLoginModal) {
    btnOpenLoginModal.addEventListener('click', () => {
      renderQuickAdvisorGrid();
      if (loginEmailInput) loginEmailInput.value = currentAdvisorUser.email || '';
      if (loginPasswordInput) loginPasswordInput.value = 'UdeA2026*';
      if (advisorLoginModal) advisorLoginModal.style.display = 'flex';
    });
  }

  if (btnCloseLoginModal) {
    btnCloseLoginModal.addEventListener('click', () => {
      if (advisorLoginModal) advisorLoginModal.style.display = 'none';
    });
  }

  if (activeAdvisorSelect) {
    activeAdvisorSelect.addEventListener('change', () => {
      const match = UDEA_ADVISORS.find(a => a.name === activeAdvisorSelect.value);
      if (match) updateAdvisorUI(match);
    });
  }

  // Inicializar UI de Asesor
  updateAdvisorUI(currentAdvisorUser);
  renderQuickAdvisorGrid();

  // Función de sanitización XSS para renderizado seguro en DOM
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Renderizar celda de identidad: Documento y Correo
  function renderLeadIdentityCell(lead) {
    const docType = lead.doc_type || 'CC';
    const docNum = lead.doc_number ? escapeHtml(lead.doc_number) : null;
    const email = lead.email ? escapeHtml(lead.email) : null;

    let docHtml = docNum 
      ? `<span class="doc-pill"><strong>${escapeHtml(docType)}:</strong> ${docNum}</span>` 
      : `<span style="font-size:0.72rem; color:var(--text-muted); font-style:italic;">Doc: Pendiente IA</span>`;

    let emailHtml = email 
      ? `<span class="email-pill" title="${email}">✉ ${email}</span>` 
      : `<span style="font-size:0.72rem; color:var(--text-muted); font-style:italic;">Email: Pendiente</span>`;

    return `<div class="doc-email-subtext">${docHtml}${emailHtml}</div>`;
  }

  // 1. Navegación entre Vistas del Dashboard
  const viewMeta = {
    'view-overview': {
      title: 'Panel General de Extensión',
      subtitle: 'Métricas ejecutivas de prospectos, resolución de IA y consumo de WhatsApp'
    },
    'view-leads': {
      title: 'Bandeja de Prospectos & CRM',
      subtitle: 'Gestión y seguimiento de médicos e interesados atendidos por el equipo'
    },
    'view-segmentation': {
      title: 'Base de Datos de Segmentación & Audiencia (IA)',
      subtitle: 'Clasificación automática en tiempo real de especialidad médica y temperatura de interés'
    },
    'view-simulator': {
      title: 'Simulador WhatsApp en Vivo',
      subtitle: 'Sandbox interactivo para validar respuestas con fechas oficiales y clasificación IA'
    },
    'view-portfolio': {
      title: 'Portafolio Académico de Extensión',
      subtitle: 'Oferta oficial con fechas de inicio, horarios y enlaces de matrícula directa'
    },
    'view-settings': {
      title: 'Configuración & Conexión Meta',
      subtitle: 'Credenciales de Google Gemini e integración oficial con Meta Cloud API'
    }
  };

  window.switchTab = (viewId) => {
    navItems.forEach(item => {
      if (item.getAttribute('data-view') === viewId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    viewPanels.forEach(panel => {
      if (panel.id === viewId) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    if (viewMeta[viewId]) {
      currentViewTitle.textContent = viewMeta[viewId].title;
      currentViewSubtitle.textContent = viewMeta[viewId].subtitle;
    }

    if (viewId === 'view-leads') renderLeads();
    if (viewId === 'view-segmentation') loadSegmentation();
    if (viewId === 'view-portfolio') renderPortfolio();
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetView = item.getAttribute('data-view');
      window.switchTab(targetView);
    });
  });

  // 2. Cargar Telemetría (Contador Mensual)
  async function loadTelemetry() {
    try {
      const res = await fetch('/api/telemetry');
      const data = await res.json();
      const m = data.metrics;
      if (quotaCount) quotaCount.textContent = `${m.used} / ${m.limit}`;
    } catch (err) {
      console.warn('Error telemetría:', err.message);
    }
  }

  // 3. Cargar Prospectos desde API
  async function fetchLeads() {
    try {
      const res = await fetch('/api/leads');
      const data = await res.json();
      allLoadedLeads = data.leads || [];

      updateOverviewKPIs();
      renderLeads();
      loadSegmentation();
    } catch (err) {
      console.error('Error fetching leads:', err);
    }
  }

  function updateOverviewKPIs() {
    const total = allLoadedLeads.length;
    const advisorNeeded = allLoadedLeads.filter(l => l.status === 'advisor_requested');

    if (kpiTotalLeads) kpiTotalLeads.textContent = total;
    if (kpiAdvisorPending) kpiAdvisorPending.textContent = advisorNeeded.length;

    // Alertas visuales
    if (advisorNeeded.length > 0) {
      if (leadsAlertBadge) {
        leadsAlertBadge.style.display = 'inline-block';
        leadsAlertBadge.textContent = advisorNeeded.length;
      }
      if (dashAlertBanner) {
        dashAlertBanner.style.display = 'flex';
        dashAlertMessage.textContent = `Hay ${advisorNeeded.length} persona(s) esperando atención de un asesor humano en este momento.`;
      }
      if (kpiAdvisorFooter) {
        kpiAdvisorFooter.textContent = '¡Atención prioritaria!';
        kpiAdvisorFooter.style.color = '#dc2626';
      }
    } else {
      if (leadsAlertBadge) leadsAlertBadge.style.display = 'none';
      if (dashAlertBanner) dashAlertBanner.style.display = 'none';
      if (kpiAdvisorFooter) {
        kpiAdvisorFooter.textContent = 'Sin pendientes urgentes';
        kpiAdvisorFooter.style.color = '#64748b';
      }
    }

    // Tasa de resolución IA
    if (total > 0 && kpiAiResolution) {
      const resolvedByAi = allLoadedLeads.filter(l => l.status === 'ai_handling' || l.status === 'closed').length;
      const pct = Math.round((resolvedByAi / total) * 100);
      kpiAiResolution.textContent = `${pct}%`;
    }

    // Preview en tabla de Overview
    if (overviewLeadsTableBody) {
      const recent = allLoadedLeads.slice(0, 5);
      if (recent.length === 0) {
        overviewLeadsTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 1.5rem;">No hay prospectos aún. Envía una consulta en el Simulador de WhatsApp.</td></tr>`;
      } else {
        overviewLeadsTableBody.innerHTML = recent.map(l => {
          const cleanPhone = (l.phone_number || '').replace(/[^\d]/g, '');
          const safeName = escapeHtml(l.name || 'Interesado UdeA');
          const safePhone = escapeHtml(l.phone_number || '');
          const safeProgram = escapeHtml(l.program_interest || 'Por definir');
          const safeMsg = escapeHtml(l.last_message || '—');

          return `
            <tr>
              <td><strong>${safeName}</strong><br><small style="color:var(--text-muted);">${safePhone}</small></td>
              <td><span style="color:var(--udea-emerald); font-weight:600;">${safeProgram}</span></td>
              <td>${getStatusPill(l.status)}</td>
              <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${safeMsg}">${safeMsg}</td>
              <td>
                <a href="https://wa.me/${cleanPhone}" target="_blank" rel="noopener" class="btn btn-wa btn-sm">
                  <svg class="mini-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                  Responder
                </a>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  function getStatusPill(status) {
    if (status === 'advisor_requested') return '<span class="status-pill advisor_requested"><span class="status-dot"></span>Requiere Asesor</span>';
    if (status === 'contacted') return '<span class="status-pill contacted"><span class="status-dot"></span>Contactado</span>';
    if (status === 'closed') return '<span class="status-pill closed"><span class="status-dot"></span>Cerrado</span>';
    return '<span class="status-pill ai_handling"><span class="status-dot"></span>Atendido por IA</span>';
  }

  function getTemperatureBadge(temp) {
    if (temp === 'hot') return '<span class="temperature-badge hot">🔥 Caliente</span>';
    if (temp === 'warm') return '<span class="temperature-badge warm">⚡ Tibio</span>';
    return '<span class="temperature-badge cold">❄️ Frío</span>';
  }

  function getProfessionPill(prof) {
    const isMed = prof && (prof.includes('Médico') || prof.includes('Especialista'));
    return `<span class="profession-pill ${isMed ? 'medico' : ''}">${escapeHtml(prof || 'Por Definir')}</span>`;
  }

  function getAdvisorPill(advisor, phone) {
    const isAssigned = advisor && advisor !== 'Sin Asignar';
    return `
      <div style="display:flex; align-items:center; gap:0.35rem;">
        <span class="advisor-pill ${isAssigned ? 'assigned' : ''}">
          <svg class="micro-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          ${escapeHtml(advisor || 'Sin Asignar')}
        </span>
        ${!isAssigned ? `<button class="btn btn-secondary btn-sm" style="padding:0.15rem 0.4rem; font-size:0.7rem;" onclick="window.assignToMe('${phone}')" title="Asignarme este caso">Tomar</button>` : ''}
      </div>
    `;
  }

  // Render CRM Leads View
  function renderLeads() {
    if (!leadsTableBody) return;
    const filter = crmFilterSelect ? crmFilterSelect.value : '';
    const advisorFilter = crmAdvisorFilter ? crmAdvisorFilter.value : '';
    const tempFilter = crmTempFilter ? crmTempFilter.value : '';
    const search = crmSearchInput ? (crmSearchInput.value || '').toLowerCase().trim() : '';

    let filtered = allLoadedLeads;
    if (filter) {
      filtered = filtered.filter(l => l.status === filter);
    }
    if (advisorFilter) {
      filtered = filtered.filter(l => (l.assigned_advisor || 'Sin Asignar') === advisorFilter);
    }
    if (tempFilter) {
      filtered = filtered.filter(l => l.interest_temperature === tempFilter);
    }
    if (search) {
      filtered = filtered.filter(l => 
        (l.phone_number && l.phone_number.includes(search)) ||
        (l.name && l.name.toLowerCase().includes(search)) ||
        (l.program_interest && l.program_interest.toLowerCase().includes(search)) ||
        (l.segment_profession && l.segment_profession.toLowerCase().includes(search))
      );
    }

    if (filtered.length === 0) {
      leadsTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-muted);">No se encontraron prospectos con los filtros actuales.</td></tr>`;
      return;
    }

    leadsTableBody.innerHTML = filtered.map(lead => {
      const cleanPhone = (lead.phone_number || '').replace(/[^\d]/g, '');
      const waLink = `https://wa.me/${cleanPhone}`;
      const safeName = escapeHtml(lead.name || 'Interesado UdeA');
      const safePhone = escapeHtml(lead.phone_number || '');
      const safeProgram = escapeHtml(lead.program_interest || 'Por definir');
      const safeMsg = escapeHtml(lead.last_message || '—');

      return `
        <tr>
          <td>
            <strong>${safeName}</strong><br>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; color: var(--text-muted);">${safePhone}</span>
          </td>
          <td>${renderLeadIdentityCell(lead)}</td>
          <td>${getProfessionPill(lead.segment_profession)}</td>
          <td>
            <span style="font-weight: 600; color: var(--udea-emerald);">${safeProgram}</span>
          </td>
          <td>${getAdvisorPill(lead.assigned_advisor, safePhone)}</td>
          <td>
            <div style="display:flex; flex-direction:column; gap:0.25rem;">
              ${getStatusPill(lead.status)}
              ${getTemperatureBadge(lead.interest_temperature)}
            </div>
          </td>
          <td style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${safeMsg}">
            ${safeMsg}
          </td>
          <td>
            <div class="action-buttons">
              <a href="${waLink}" target="_blank" rel="noopener" class="btn btn-wa btn-sm" title="Abrir chat en WhatsApp Web">
                <svg class="mini-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                WhatsApp
              </a>
              <button class="btn btn-secondary btn-sm" onclick="window.viewChat('${safePhone}')">
                <svg class="mini-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h20v14H6l-4 4V3z"/></svg>
                Ver Chat
              </button>
              ${lead.status === 'advisor_requested' ? `
                <button class="btn btn-primary btn-sm" onclick="window.markAttendedByActiveAdvisor('${safePhone}')" title="Marcar como atendido por el asesor activo">
                  <svg class="mini-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Atendido
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // 4. Cargar y Renderizar Vista de Segmentación en Tiempo Real
  async function loadSegmentation() {
    try {
      const res = await fetch('/api/segmentation');
      const data = await res.json();
      if (!data.success) return;

      const stats = data.stats || {};
      const audience = data.audience || [];

      // KPIs
      if (kpiSegTotal) kpiSegTotal.textContent = stats.total_leads || 0;
      if (kpiSegHot) kpiSegHot.textContent = stats.temperatures ? (stats.temperatures['hot'] || 0) : 0;
      
      const medicosCount = stats.professions ? 
        ((stats.professions['Médico Especialista'] || 0) + (stats.professions['Médico General'] || 0) + (stats.professions['Residente'] || 0)) : 0;
      if (kpiSegMedicos) kpiSegMedicos.textContent = medicosCount;

      const saludCount = stats.professions ? 
        ((stats.professions['Enfermería'] || 0) + (stats.professions['Profesional de la Salud'] || 0) + (stats.professions['Estudiante de Medicina'] || 0)) : 0;
      if (kpiSegSalud) kpiSegSalud.textContent = saludCount;

      // Barras de Perfil Profesional
      if (segProfessionBars && stats.professions) {
        const total = stats.total_leads || 1;
        const entries = Object.entries(stats.professions).sort((a,b) => b[1] - a[1]);
        segProfessionBars.innerHTML = entries.map(([prof, count]) => {
          const pct = Math.round((count / total) * 100);
          return `
            <div class="bar-row">
              <span class="bar-label">${escapeHtml(prof)}</span>
              <div class="bar-track"><div class="bar-fill" style="width: ${pct}%;"></div></div>
              <span class="bar-num">${count} (${pct}%)</span>
            </div>
          `;
        }).join('');
      }

      // Barras de Temperatura
      if (segTemperatureBars && stats.temperatures) {
        const total = stats.total_leads || 1;
        const tempLabels = {
          hot: '🔥 Caliente (Alta Intención / Pago / Asesor)',
          warm: '⚡ Tibio (Consulta Fechas / Horarios / Pensum)',
          cold: '❄️ Frío (Contacto Inicial / Saludo General)'
        };
        const tempColors = {
          hot: '#ef4444',
          warm: '#f59e0b',
          cold: '#3b82f6'
        };

        segTemperatureBars.innerHTML = ['hot', 'warm', 'cold'].map(tempKey => {
          const count = stats.temperatures[tempKey] || 0;
          const pct = Math.round((count / total) * 100);
          return `
            <div class="bar-row">
              <span class="bar-label">${tempLabels[tempKey]}</span>
              <div class="bar-track"><div class="bar-fill" style="width: ${pct}%; background-color: ${tempColors[tempKey]};"></div></div>
              <span class="bar-num">${count} (${pct}%)</span>
            </div>
          `;
        }).join('');
      }

      // Render Tabla de Audiencia
      renderSegmentationTable(audience);

    } catch (err) {
      console.error('Error cargando segmentación:', err);
    }
  }

  function renderSegmentationTable(audience) {
    if (!segTableBody) return;
    const filterProf = segFilterProfSelect ? segFilterProfSelect.value : '';
    const filterTemp = segFilterTempSelect ? segFilterTempSelect.value : '';

    let filtered = audience;
    if (filterProf) {
      filtered = filtered.filter(a => a.segment_profession === filterProf);
    }
    if (filterTemp) {
      filtered = filtered.filter(a => a.interest_temperature === filterTemp);
    }

    if (filtered.length === 0) {
      segTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-muted);">No hay registros con los filtros de segmentación seleccionados.</td></tr>`;
      return;
    }

    segTableBody.innerHTML = filtered.map(lead => {
      const cleanPhone = (lead.phone_number || '').replace(/[^\d]/g, '');
      const waLink = `https://wa.me/${cleanPhone}`;
      const safeName = escapeHtml(lead.name || 'Interesado UdeA');
      const safePhone = escapeHtml(lead.phone_number || '');
      const safeArea = escapeHtml(lead.thematic_area || 'Clínica General');
      const safeEvents = escapeHtml(lead.event_interests || lead.program_interest || 'General');

      return `
        <tr>
          <td>
            <strong>${safeName}</strong><br>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; color: var(--text-muted);">${safePhone}</span>
          </td>
          <td>${renderLeadIdentityCell(lead)}</td>
          <td>${getProfessionPill(lead.segment_profession)}</td>
          <td>${getTemperatureBadge(lead.interest_temperature)}</td>
          <td><span style="font-size:0.8rem; font-weight:600; color:var(--udea-dark);">${safeArea}</span></td>
          <td style="max-width:240px; font-size:0.8rem; color:var(--udea-emerald); font-weight:600;">${safeEvents}</td>
          <td>${getAdvisorPill(lead.assigned_advisor, safePhone)}</td>
          <td>
            <div class="action-buttons">
              <a href="${waLink}" target="_blank" rel="noopener" class="btn btn-wa btn-sm">WhatsApp</a>
              <button class="btn btn-secondary btn-sm" onclick="window.viewChat('${safePhone}')">Chat</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  if (segFilterProfSelect) segFilterProfSelect.addEventListener('change', loadSegmentation);
  if (segFilterTempSelect) segFilterTempSelect.addEventListener('change', loadSegmentation);
  if (btnRefreshSegmentation) btnRefreshSegmentation.addEventListener('click', loadSegmentation);

  // 5. Asignación Rápida a Mí
  window.assignToMe = async (phone) => {
    const advisor = getActiveAdvisor();
    await fetch(`/api/leads/${encodeURIComponent(phone)}/advisor`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ advisor })
    });
    fetchLeads();
  };

  window.markAttendedByActiveAdvisor = async (phone) => {
    const advisor = getActiveAdvisor();
    await fetch(`/api/leads/${encodeURIComponent(phone)}/attend`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ advisor })
    });
    fetchLeads();
  };

  // 6. Ver Historial Completo y Panel de Asesor en Modal
  window.viewChat = async (phone) => {
    currentActivePhone = phone;
    const safePhone = escapeHtml(phone);
    modalChatTitle.textContent = `Conversación con ${safePhone}`;
    modalChatBody.innerHTML = '<p>Cargando mensajes del historial...</p>';
    modalChatFooter.innerHTML = '';
    chatModal.style.display = 'flex';

    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(phone)}/chat`);
      const data = await res.json();
      const messages = data.messages || [];
      const lead = data.lead || {};

      // Configurar controles del Asesor
      if (modalAdvisorSelect) {
        modalAdvisorSelect.value = lead.assigned_advisor || 'Sin Asignar';
      }
      if (modalNotesInput) {
        modalNotesInput.value = lead.notes || '';
      }
      if (modalAttendedByBadge) {
        if (lead.attended_by) {
          modalAttendedByBadge.textContent = `Atendido por: ${lead.attended_by} (${new Date(lead.attended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
          modalAttendedByBadge.style.color = '#059669';
        } else {
          modalAttendedByBadge.textContent = 'Aún no atendido formalmente';
          modalAttendedByBadge.style.color = '#dc2626';
        }
      }

      if (messages.length === 0) {
        modalChatBody.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding:1.5rem;">Sin mensajes registrados en el sistema.</p>';
      } else {
        modalChatBody.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${messages.map(m => {
              const isUser = m.sender === 'user';
              const time = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const safeContent = escapeHtml(m.content);
              return `
                <div style="align-self: ${isUser ? 'flex-end' : 'flex-start'}; background: ${isUser ? 'var(--wa-bubble-user)' : '#f1f5f9'}; padding: 0.65rem 0.95rem; border-radius: 8px; max-width: 85%; font-size: 0.85rem; white-space: pre-wrap; line-height: 1.45;">
                  <strong>${isUser ? 'Estudiante / Interesado' : 'Asistente Oficial UdeA'}:</strong><br>
                  ${safeContent}
                  <div style="font-size: 0.65rem; color: #94a3b8; text-align: right; margin-top: 0.3rem;">${time}</div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      const cleanPhone = phone.replace(/[^\d]/g, '');
      modalChatFooter.innerHTML = `
        <a href="https://wa.me/${cleanPhone}" target="_blank" rel="noopener" class="btn btn-wa">
          <svg class="mini-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          Abrir en WhatsApp Web
        </a>
      `;
    } catch (err) {
      modalChatBody.innerHTML = `<p style="color: red;">Error: ${escapeHtml(err.message)}</p>`;
    }
  };

  // Eventos en Modal de Chat
  if (modalAdvisorSelect) {
    modalAdvisorSelect.addEventListener('change', async () => {
      if (!currentActivePhone) return;
      await fetch(`/api/leads/${encodeURIComponent(currentActivePhone)}/advisor`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advisor: modalAdvisorSelect.value })
      });
      fetchLeads();
    });
  }

  if (btnModalTakeCase) {
    btnModalTakeCase.addEventListener('click', async () => {
      if (!currentActivePhone) return;
      const myName = getActiveAdvisor();
      modalAdvisorSelect.value = myName;
      await fetch(`/api/leads/${encodeURIComponent(currentActivePhone)}/advisor`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advisor: myName })
      });
      fetchLeads();
      alert(`Caso asignado exitosamente a ${myName}`);
    });
  }

  if (btnModalMarkAttended) {
    btnModalMarkAttended.addEventListener('click', async () => {
      if (!currentActivePhone) return;
      const myName = getActiveAdvisor();
      await fetch(`/api/leads/${encodeURIComponent(currentActivePhone)}/attend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advisor: myName })
      });
      if (modalAttendedByBadge) {
        modalAttendedByBadge.textContent = `Atendido por: ${myName} (Recién registrado)`;
        modalAttendedByBadge.style.color = '#059669';
      }
      fetchLeads();
      alert(`Registrado que el caso fue atendido por ${myName}`);
    });
  }

  if (btnSaveNotes) {
    btnSaveNotes.addEventListener('click', async () => {
      if (!currentActivePhone || !modalNotesInput) return;
      const notes = modalNotesInput.value.trim();
      await fetch(`/api/leads/${encodeURIComponent(currentActivePhone)}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      });
      fetchLeads();
      alert('Nota guardada correctamente en la ficha del lead.');
    });
  }

  btnCloseModal.addEventListener('click', () => {
    chatModal.style.display = 'none';
    currentActivePhone = null;
  });

  // 7. Simulador WhatsApp
  simulatorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = simPhoneInput.value.trim() || '+573001234567';
    const message = simMessageInput.value.trim();
    if (!message) return;

    appendBubble(message, 'user');
    simMessageInput.value = '';

    const typingBubble = document.createElement('div');
    typingBubble.className = 'wa-bubble bot';
    typingBubble.innerHTML = '<em>Escribiendo respuesta oficial de Medicina UdeA...</em>';
    chatWindow.appendChild(typingBubble);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    try {
      const res = await fetch('/api/simulator/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone, message })
      });
      const data = await res.json();

      typingBubble.remove();

      if (data.replyText) {
        appendBubble(data.replyText, 'bot');
      }

      if (data.requestAdvisor) {
        simFeedback.innerHTML = `
          <span style="color: #dc2626; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem;">
            <svg class="mini-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Solicitud de Asesor Humano Activada
          </span>
          <br>El bot detectó la necesidad de atención humana y priorizó al contacto en el CRM.
        `;
      } else {
        simFeedback.innerHTML = `
          <span style="color: #059669; font-weight: 600; display: inline-flex; align-items: center; gap: 0.35rem;">
            <svg class="mini-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Mensaje procesado y segmentado exitosamente.
          </span>
          <br>Perfil detectado: <strong>${escapeHtml(data.segmentation ? data.segmentation.profession : 'Salud')}</strong> · Temp: <strong>${data.segmentation ? data.segmentation.temperature : 'normal'}</strong>.
        `;
      }

      loadTelemetry();
      fetchLeads();

    } catch (err) {
      typingBubble.remove();
      appendBubble(`Error de conexión: ${err.message}`, 'bot');
    }
  });

  function appendBubble(text, sender) {
    const bubble = document.createElement('div');
    bubble.className = `wa-bubble ${sender}`;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    bubble.innerHTML = `${formatWhatsAppText(text)}<div class="wa-time">${time}</div>`;
    chatWindow.appendChild(bubble);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function formatWhatsAppText(text) {
    return text.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
  }

  quickPromptButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = btn.getAttribute('data-msg');
      simMessageInput.value = msg;
      simulatorForm.dispatchEvent(new Event('submit'));
    });
  });

  // 8. Cargar Portafolio Oficial de Cursos (con Fechas y Horarios)
  async function fetchPortfolio() {
    try {
      const res = await fetch('/api/knowledge');
      const data = await res.json();
      allPortfolioItems = data.items || [];

      if (coursesNavBadge) coursesNavBadge.textContent = allPortfolioItems.length;
      if (kpiTotalPrograms) kpiTotalPrograms.textContent = allPortfolioItems.length;
      renderPortfolio();
    } catch (err) {
      console.error('Error fetching portfolio:', err);
    }
  }

  function renderPortfolio() {
    if (!portfolioGrid) return;
    const catFilter = portfolioFilterCategory ? portfolioFilterCategory.value : '';
    let items = allPortfolioItems;

    if (catFilter) {
      items = items.filter(i => i.category === catFilter);
    }

    portfolioGrid.innerHTML = items.map(item => {
      const safeCategory = escapeHtml(item.category);
      const safeTitle = escapeHtml(item.title);
      const safeHours = item.duration_hours > 0 ? `${parseInt(item.duration_hours, 10)} hrs` : 'Variable';
      const safeModality = escapeHtml(item.modality);
      const safeCode = escapeHtml(item.code);
      const safeDesc = escapeHtml(item.description);
      const safeInvest = escapeHtml(item.investment || 'Consultar');
      const safeStartDate = escapeHtml(item.start_date || '');
      const safeSchedule = escapeHtml(item.schedule || '');
      const safeLink = encodeURI(item.registration_link || 'https://extension.medicinaudea.co');

      return `
        <div class="portfolio-card">
          <div>
            <span class="card-tag">${safeCategory}</span>
            <h3 class="card-title">${safeTitle}</h3>
            <div class="card-meta">
              <span class="meta-item"><svg class="micro-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${safeHours}</span>
              <span class="meta-item"><svg class="micro-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> ${safeModality}</span>
              <span class="meta-item"><svg class="micro-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> ${safeCode}</span>
            </div>

            <!-- Fechas y Horarios Oficiales -->
            <div style="margin-bottom: 0.75rem;">
              ${safeStartDate ? `
                <div class="card-date-badge">
                  <svg class="micro-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span>Inicia: ${safeStartDate}</span>
                </div>
              ` : ''}
              ${safeSchedule ? `
                <div class="card-schedule-badge">
                  <svg class="micro-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>${safeSchedule}</span>
                </div>
              ` : ''}
            </div>

            <p class="card-desc">${safeDesc}</p>
          </div>
          <div class="card-footer">
            <span class="card-investment">${safeInvest}</span>
            <a href="${safeLink}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">
              <span>Portal Oficial</span>
              <svg class="mini-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>
        </div>
      `;
    }).join('');
  }

  // Sincronización Web Scraping en Vivo
  if (btnSyncWeb) {
    btnSyncWeb.addEventListener('click', async () => {
      btnSyncWeb.classList.add('loading');
      btnSyncWeb.disabled = true;
      syncStatusAlert.style.display = 'flex';
      syncStatusAlert.style.borderLeftColor = 'var(--udea-emerald)';
      syncStatusAlert.innerHTML = `
        <span style="display:inline-flex; align-items:center; gap:0.5rem;">
          <svg class="mini-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
          Conectando con <strong>extension.medicinaudea.co</strong> y analizando cursos y fechas en vivo...
        </span>
      `;

      try {
        const res = await fetch('/api/knowledge/sync', { method: 'POST' });
        const data = await res.json();

        if (data.success) {
          syncStatusAlert.style.borderLeftColor = '#10b981';
          syncStatusAlert.innerHTML = `
            <span style="display:inline-flex; align-items:center; gap:0.5rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:#059669;"><polyline points="20 6 9 17 4 12"/></svg>
              <span><strong>¡Sincronización Exitosa!</strong> Se han actualizado <strong>${data.count} programas</strong> con sus fechas de inicio y horarios oficiales directamente desde la web UdeA.</span>
            </span>
          `;
          await fetchPortfolio();
        } else {
          syncStatusAlert.style.borderLeftColor = '#ef4444';
          syncStatusAlert.innerHTML = `
            <span style="display:inline-flex; align-items:center; gap:0.5rem; color:#b91c1c;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>Error al sincronizar: ${data.error}</span>
            </span>
          `;
        }
      } catch (err) {
        syncStatusAlert.style.borderLeftColor = '#ef4444';
        syncStatusAlert.innerHTML = `
          <span style="display:inline-flex; align-items:center; gap:0.5rem; color:#b91c1c;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>Error de conexión: ${err.message}</span>
          </span>
        `;
      } finally {
        btnSyncWeb.classList.remove('loading');
        btnSyncWeb.disabled = false;
      }
    });
  }

  if (portfolioFilterCategory) portfolioFilterCategory.addEventListener('change', renderPortfolio);

  // Modal Nuevo Curso
  if (btnOpenNewCourseModal) btnOpenNewCourseModal.addEventListener('click', () => { courseModal.style.display = 'flex'; });
  if (btnCloseCourseModal) btnCloseCourseModal.addEventListener('click', () => { courseModal.style.display = 'none'; });

  if (newCourseForm) {
    newCourseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        code: document.getElementById('courseCode').value.trim(),
        title: document.getElementById('courseTitle').value.trim(),
        category: document.getElementById('courseCategory').value,
        modality: document.getElementById('courseModality').value,
        duration_hours: document.getElementById('courseHours').value,
        investment: document.getElementById('courseInvestment').value.trim(),
        start_date: document.getElementById('courseStartDate').value.trim(),
        schedule: document.getElementById('courseSchedule').value.trim(),
        description: document.getElementById('courseDesc').value.trim(),
        registration_link: 'https://extension.medicinaudea.co',
        contact_email: 'aprendizajes.med@udea.edu.co'
      };

      try {
        const res = await fetch('/api/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          courseModal.style.display = 'none';
          newCourseForm.reset();
          await fetchPortfolio();
          alert('Programa con fechas oficiales agregado exitosamente a la base de conocimiento.');
        } else {
          const err = await res.json();
          alert('Error: ' + err.error);
        }
      } catch (err) {
        alert('Error guardando: ' + err.message);
      }
    });
  }

  // Guardar Gemini Key
  if (btnSaveGeminiKey) {
    btnSaveGeminiKey.addEventListener('click', async () => {
      const key = geminiKeyInput.value.trim();
      if (!key) return alert('Por favor ingresa una clave válida');

      try {
        const res = await fetch('/api/settings/gemini-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: key })
        });
        const data = await res.json();
        if (data.success) {
          geminiKeyStatus.textContent = 'Clave activada con éxito para Gemini 3.8 Flash.';
          geminiKeyInput.value = '';
          loadTelemetry();
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }

  // Filtros CRM
  if (crmFilterSelect) crmFilterSelect.addEventListener('change', renderLeads);
  if (crmAdvisorFilter) crmAdvisorFilter.addEventListener('change', renderLeads);
  if (crmTempFilter) crmTempFilter.addEventListener('change', renderLeads);
  if (crmSearchInput) crmSearchInput.addEventListener('input', renderLeads);
  if (btnRefreshLeads) btnRefreshLeads.addEventListener('click', () => { fetchLeads(); loadTelemetry(); });
  if (btnGlobalRefresh) btnGlobalRefresh.addEventListener('click', () => { fetchLeads(); fetchPortfolio(); loadTelemetry(); });

  // Inicialización Inmediata
  loadTelemetry();
  fetchLeads();
  fetchPortfolio();

  // Polling automático cada 7 segundos para mantener todo en tiempo real
  setInterval(() => {
    loadTelemetry();
    fetchLeads();
  }, 7000);
});

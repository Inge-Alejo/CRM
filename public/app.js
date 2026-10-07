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
  const inboxPendingBadge = document.getElementById('inboxPendingBadge');
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
  const btnSimResetChat = document.getElementById('btnSimResetChat');
  const btnSimNewConversation = document.getElementById('btnSimNewConversation');
  const btnQuickInitChat = document.getElementById('btnQuickInitChat');

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

  // Elementos de la Landing Page de Login y Dashboard
  const loginLandingView = document.getElementById('loginLandingView');
  const dashboardAppView = document.getElementById('dashboardAppView');
  const landingAlertBox = document.getElementById('landingAlertBox');

  const topbarAdvisorName = document.getElementById('topbarAdvisorName');
  const topbarAdvisorAvatar = document.getElementById('topbarAdvisorAvatar');
  const topbarAdvisorRole = document.getElementById('topbarAdvisorRole');
  const btnLogoutAdvisor = document.getElementById('btnLogoutAdvisor');

  const advisorLoginForm = document.getElementById('advisorLoginForm');
  const loginEmailInput = document.getElementById('loginEmailInput');
  const loginPasswordInput = document.getElementById('loginPasswordInput');
  const btnLoginSubmit = document.getElementById('btnLoginSubmit');

  let allLoadedLeads = [];
  let allPortfolioItems = [];
  let allAdvisorsList = [];
  let currentActivePhone = null;

  async function loadAdvisorsList() {
    try {
      const res = await fetch('/api/advisors');
      const data = await res.json();
      allAdvisorsList = data.advisors || [];
      if (crmAdvisorFilter && allAdvisorsList.length > 0) {
        const cur = crmAdvisorFilter.value;
        crmAdvisorFilter.innerHTML = '<option value="">Todos los asesores</option><option value="Sin Asignar">Sin Asignar</option>' +
          allAdvisorsList.map(a => `<option value="${escapeHtml(a.name)}">${escapeHtml(a.name)}</option>`).join('');
        crmAdvisorFilter.value = cur;
      }
      if (modalAdvisorSelect && allAdvisorsList.length > 0) {
        const cur = modalAdvisorSelect.value;
        modalAdvisorSelect.innerHTML = '<option value="Sin Asignar">Sin Asignar</option>' +
          allAdvisorsList.map(a => `<option value="${escapeHtml(a.name)}">${escapeHtml(a.name)}</option>`).join('');
        modalAdvisorSelect.value = cur;
      }
    } catch (err) {
      console.warn('Error cargando lista de asesores:', err);
    }
  }

  // Configuración oficial de Firebase Auth (crm-fdem)
  const OFFICIAL_FIREBASE_CONFIG = {
    apiKey: "AIzaSyCTwp8PaJvGlTYjJnBV7ktvnDeHd8aYemk",
    authDomain: "crm-fdem.firebaseapp.com",
    projectId: "crm-fdem",
    storageBucket: "crm-fdem.firebasestorage.app",
    messagingSenderId: "191713944750",
    appId: "1:191713944750:web:f68debb069680dcab8393f",
    measurementId: "G-TY0MRHK341"
  };

  // Firebase Auth SDK state
  let firebaseAuth = null;
  let firebaseApp = null;
  let firebaseSignIn = null;
  let firebaseSignOut = null;

  // Inicializar Firebase Auth Oficial
  async function initFirebaseClient() {
    let configToUse = OFFICIAL_FIREBASE_CONFIG;
    try {
      const res = await fetch('/api/config/client');
      const data = await res.json();
      if (data && data.firebase && data.firebase.apiKey) {
        configToUse = data.firebase;
      }
    } catch (e) {
      // Usar OFFICIAL_FIREBASE_CONFIG
    }

    try {
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
      const { getAuth, signInWithEmailAndPassword, signOut } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');
      
      firebaseApp = initializeApp(configToUse);
      firebaseAuth = getAuth(firebaseApp);
      firebaseSignIn = signInWithEmailAndPassword;
      firebaseSignOut = signOut;
    } catch (err) {
      console.warn('Aviso: Inicialización de Firebase con fallback local:', err.message);
    }
  }

  // Estado de sesión del Asesor/Admin
  let currentAdvisorUser = JSON.parse(localStorage.getItem('udea_advisor_user') || 'null');

  // Control de Roles y Permisos (RBAC)
  function applyRolePermissions(user) {
    if (!user) return;
    const isSuperAdmin = (user.role_type === 'admin' || (user.email && user.email.toLowerCase() === 'proyectostic.med@udea.edu.co'));

    // 1. Visibilidad en el Sidebar de Navegación
    const adminNavItems = document.querySelectorAll('.nav-item[data-role="admin"]');
    adminNavItems.forEach(el => {
      el.style.display = isSuperAdmin ? 'flex' : 'none';
    });

    // 2. Acciones del Portafolio (Sincronización Web y Nuevo Programa)
    const btnSyncWebEl = document.getElementById('btnSyncWeb');
    const btnOpenNewCourseEl = document.getElementById('btnOpenNewCourseModal');
    if (btnSyncWebEl) {
      btnSyncWebEl.style.display = isSuperAdmin ? 'inline-flex' : 'none';
    }
    if (btnOpenNewCourseEl) {
      btnOpenNewCourseEl.style.display = isSuperAdmin ? 'inline-flex' : 'none';
    }

    // 3. Si un asesor intenta abrir una pestaña prohibida, redirigir al Panel General
    const activeView = document.querySelector('.view-panel.active');
    if (activeView && !isSuperAdmin) {
      const activeId = activeView.id;
      if (activeId === 'view-segmentation' || activeId === 'view-simulator' || activeId === 'view-settings' || activeId === 'view-system-admin') {
        const overviewBtn = document.querySelector('.nav-item[data-view="view-overview"]');
        if (overviewBtn) overviewBtn.click();
      }
    }
  }

  function updateAdvisorUI(adv) {
    if (!adv) return;
    currentAdvisorUser = adv;
    localStorage.setItem('udea_advisor_user', JSON.stringify(adv));

    const isSuperAdmin = (adv.role_type === 'admin' || (adv.email && adv.email.toLowerCase() === 'proyectostic.med@udea.edu.co'));

    if (topbarAdvisorName) {
      topbarAdvisorName.textContent = isSuperAdmin ? 'Administrador General TIC' : (adv.name || 'Asesor UdeA');
    }

    if (topbarAdvisorRole) {
      if (isSuperAdmin) {
        topbarAdvisorRole.textContent = 'Admin General TIC';
        topbarAdvisorRole.className = 'advisor-role-text admin-badge';
      } else {
        topbarAdvisorRole.textContent = adv.role || 'Asesor de Extensión';
        topbarAdvisorRole.className = 'advisor-role-text';
      }
    }

    if (topbarAdvisorAvatar) {
      if (isSuperAdmin) {
        topbarAdvisorAvatar.textContent = 'TIC';
      } else {
        const ini = adv.avatar || (adv.name ? adv.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() : 'AS');
        topbarAdvisorAvatar.textContent = ini;
      }
    }

    applyRolePermissions(adv);
  }

  function getActiveAdvisor() {
    return currentAdvisorUser ? currentAdvisorUser.name : (localStorage.getItem('udea_active_advisor') || 'Administrador General TIC');
  }

  // Login handler institucional con Firebase Authentication
  async function performLogin(email, password) {
    try {
      if (landingAlertBox) landingAlertBox.style.display = 'none';
      if (btnLoginSubmit) {
        btnLoginSubmit.disabled = true;
        btnLoginSubmit.textContent = 'Verificando con Firebase...';
      }

      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanPassword = (password || '').trim();

      if (!cleanEmail || !cleanPassword) {
        if (landingAlertBox) {
          landingAlertBox.textContent = 'Por favor ingresa tu correo institucional y contraseña.';
          landingAlertBox.style.display = 'block';
        }
        return false;
      }

      let firebaseVerified = false;
      let firebaseUid = null;
      let displayName = null;

      // 1. Intento de verificación contra Firebase Authentication en tiempo real (crm-fdem)
      if (firebaseAuth && firebaseSignIn) {
        try {
          const userCred = await firebaseSignIn(firebaseAuth, cleanEmail, cleanPassword);
          if (userCred && userCred.user) {
            firebaseVerified = true;
            firebaseUid = userCred.user.uid;
            displayName = userCred.user.displayName;
          }
        } catch (fbErr) {
          console.warn('Aviso Firebase SDK cliente (se procede con validación segura de servidor):', fbErr.code, fbErr.message);
          // Si el SDK cliente reporta credencial inválida pero el servidor puede verificarla via REST o validar Admin,
          // no abortamos aquí para no bloquear al usuario por restricciones de dominio Vercel o CSP.
        }
      }

      // 2. Sincronizar y validar sesión en base de datos del servidor con RBAC
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword, firebaseVerified, displayName, firebaseUid })
      });
      const data = await res.json();
      if (!data.success) {
        if (landingAlertBox) {
          landingAlertBox.textContent = data.error || 'Credenciales no autorizadas.';
          landingAlertBox.style.display = 'block';
        }
        return false;
      }

      localStorage.setItem('udea_auth_token', data.token);
      localStorage.setItem('udea_advisor_user', JSON.stringify(data.advisor));
      updateAdvisorUI(data.advisor);

      // Desbloqueo y transición inmediata al Dashboard
      if (loginLandingView) loginLandingView.style.display = 'none';
      if (dashboardAppView) dashboardAppView.style.display = 'flex';

      loadAdvisorsList();
      loadTelemetry();
      fetchLeads();
      fetchPortfolio();
      return true;
    } catch (err) {
      if (landingAlertBox) {
        landingAlertBox.textContent = 'Error de conexión: ' + err.message;
        landingAlertBox.style.display = 'block';
      }
      return false;
    } finally {
      if (btnLoginSubmit) {
        btnLoginSubmit.disabled = false;
        btnLoginSubmit.innerHTML = `<span>Ingresar al CRM</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`;
      }
    }
  }

  // Listeners de Autenticación
  if (advisorLoginForm) {
    advisorLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginEmailInput ? loginEmailInput.value.trim() : '';
      const password = loginPasswordInput ? loginPasswordInput.value.trim() : '';
      await performLogin(email, password);
    });
  }

  if (btnLogoutAdvisor) {
    btnLogoutAdvisor.addEventListener('click', async () => {
      if (firebaseAuth && firebaseSignOut) {
        try { await firebaseSignOut(firebaseAuth); } catch (e) {}
      }
      localStorage.removeItem('udea_auth_token');
      localStorage.removeItem('udea_advisor_user');
      currentAdvisorUser = null;
      if (landingAlertBox) landingAlertBox.style.display = 'none';
      if (dashboardAppView) dashboardAppView.style.display = 'none';
      if (loginLandingView) loginLandingView.style.display = 'flex';
    });
  }

  // Inicializar UI de Asesor y Firebase
  if (currentAdvisorUser) {
    updateAdvisorUI(currentAdvisorUser);
  }
  initFirebaseClient();

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
    'view-inbox': {
      title: 'Bandeja del Asesor (Agent Workspace)',
      subtitle: 'Consola unificada de atención omnicanal WhatsApp · Cola de triage, chat en vivo y Customer 360'
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
    'view-system-admin': {
      title: 'Panel de Control TIC · Métricas del Sistema',
      subtitle: 'Administración de bases de datos, tokens de IA, WhatsApp Cloud y consola de auditoría'
    },
    'view-settings': {
      title: 'Configuración & Conexión Meta',
      subtitle: 'Credenciales de Google Gemini e integración oficial con Meta Cloud API'
    }
  };

  window.switchTab = (viewId) => {
    const isSuperAdmin = currentAdvisorUser && (currentAdvisorUser.role_type === 'admin' || (currentAdvisorUser.email && currentAdvisorUser.email.toLowerCase() === 'proyectostic.med@udea.edu.co'));
    if (!isSuperAdmin && (viewId === 'view-segmentation' || viewId === 'view-simulator' || viewId === 'view-settings' || viewId === 'view-system-admin')) {
      viewId = 'view-overview';
    }

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

    if (viewId === 'view-inbox') renderInbox();
    if (viewId === 'view-leads') renderLeads();
    if (viewId === 'view-segmentation') loadSegmentation();
    if (viewId === 'view-portfolio') renderPortfolio();
    if (viewId === 'view-system-admin') loadSystemAdminMetrics();
    if (viewId === 'view-simulator') loadSimulatorChat(simPhoneInput ? simPhoneInput.value : null, false);
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
      renderInbox(true);
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
      if (inboxPendingBadge) {
        inboxPendingBadge.style.display = 'inline-block';
        inboxPendingBadge.textContent = advisorNeeded.length;
      }
      if (dashAlertBanner) {
        dashAlertBanner.style.display = 'flex';
        dashAlertMessage.textContent = `Hay ${advisorNeeded.length} persona(s) esperando atención de un asesor en este momento.`;
      }
      if (kpiAdvisorFooter) {
        kpiAdvisorFooter.textContent = '¡Atención prioritaria!';
        kpiAdvisorFooter.style.color = '#dc2626';
      }
    } else {
      if (leadsAlertBadge) leadsAlertBadge.style.display = 'none';
      if (inboxPendingBadge) inboxPendingBadge.style.display = 'none';
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
    if (status === 'attended') return '<span class="status-pill attended"><span class="status-dot"></span>✓ Atendido</span>';
    if (status === 'contacted') return '<span class="status-pill contacted"><span class="status-dot"></span>Contactado</span>';
    if (status === 'enrolled') return '<span class="status-pill enrolled"><span class="status-dot"></span>🎓 Matriculado</span>';
    if (status === 'closed') return '<span class="status-pill closed"><span class="status-dot"></span>Cerrado</span>';
    return '<span class="status-pill ai_handling"><span class="status-dot"></span>Atendido por IA</span>';
  }

  function getTemperatureBadge(temp) {
    if (temp === 'hot') return '<span class="priority-badge hot">Prioridad Alta</span>';
    if (temp === 'warm') return '<span class="priority-badge warm">Prioridad Media</span>';
    return '<span class="priority-badge cold">Prioridad Estándar</span>';
  }

  function getProfessionPill(prof) {
    const isMed = prof && (prof.includes('Médico') || prof.includes('Especialista'));
    return `<span class="profession-pill ${isMed ? 'medico' : ''}">${escapeHtml(prof || 'Por Definir')}</span>`;
  }

  function getAdvisorPill(advisor, phone) {
    const isSuperAdmin = currentAdvisorUser && (currentAdvisorUser.role_type === 'admin' || (currentAdvisorUser.email && currentAdvisorUser.email.toLowerCase() === 'proyectostic.med@udea.edu.co'));
    const currentAdv = advisor || 'Sin Asignar';

    // Si es Administrador TIC: selector interactivo para asignar/reasignar directamente a cualquier asesor
    if (isSuperAdmin && allAdvisorsList.length > 0) {
      const options = [
        `<option value="Sin Asignar" ${currentAdv === 'Sin Asignar' ? 'selected' : ''}>Sin Asignar</option>`,
        ...allAdvisorsList.map(a => `<option value="${escapeHtml(a.name)}" ${currentAdv === a.name ? 'selected' : ''}>${escapeHtml(a.name)}</option>`)
      ].join('');

      return `
        <div style="display:flex; align-items:center; gap:0.35rem;">
          <select class="form-select form-select-sm" onchange="window.reassignAdvisor('${phone}', this.value)" title="Reasignar asesor manualmente (Exclusivo Administrador TIC)" style="padding: 0.15rem 0.35rem; font-size: 0.76rem; font-weight: 600; border: 1px solid var(--udea-emerald); border-radius: 6px; background: #ffffff; cursor: pointer; color: var(--text-dark);">
            ${options}
          </select>
        </div>
      `;
    }

    const isAssigned = currentAdv !== 'Sin Asignar';
    return `
      <div style="display:flex; align-items:center; gap:0.35rem;">
        <span class="advisor-pill ${isAssigned ? 'assigned' : ''}">
          <svg class="micro-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          ${escapeHtml(currentAdv)}
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
              <button class="btn btn-primary btn-sm" onclick="window.openLeadInWorkspace('${safePhone}')" title="Atender en Bandeja del Asesor (Consola 3 Columnas estilo Zendesk/Intercom)">
                <svg class="mini-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Atender
              </button>
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
      if (data.success === false) return;

      const stats = data.stats || {};
      const audience = data.audience || data.leads || [];

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

      // Barras de Temperatura (sin emojis)
      if (segTemperatureBars && stats.temperatures) {
        const total = stats.total_leads || 1;
        const tempLabels = {
          hot: 'Prioridad Alta (Pago / Asesor / Matrícula)',
          warm: 'Prioridad Media (Fechas / Horarios / Contenidos)',
          cold: 'Prioridad Baja (Contacto Inicial)'
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

  // 5. Asignación Rápida a Mí y Reasignación Manual por Admin
  window.assignToMe = async (phone) => {
    const advisor = getActiveAdvisor();
    await fetch(`/api/leads/${encodeURIComponent(phone)}/advisor`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ advisor })
    });
    fetchLeads();
  };

  window.reassignAdvisor = async (phone, advisorName) => {
    try {
      await fetch(`/api/leads/${encodeURIComponent(phone)}/advisor`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advisor: advisorName })
      });
      fetchLeads();
    } catch (err) {
      alert('Error reasignando asesor: ' + err.message);
    }
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

  // 7. Simulador WhatsApp (Modo Sandbox con respuesta autónoma garantizada)
  window.triggerSimulatorReset = async function() {
    const phone = simPhoneInput ? simPhoneInput.value : '+573001234567';
    await loadSimulatorChat(phone, true);
  };

  async function loadSimulatorChat(phone, forceReset = false) {
    if (!chatWindow) return;
    const cleanPhone = (phone || (simPhoneInput ? simPhoneInput.value : '') || '+573001234567').trim();

    // Feedback visual inmediato en el botón de reinicio
    if (btnSimResetChat && forceReset) {
      btnSimResetChat.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spin-icon"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
        <span>Reiniciando...</span>
      `;
    }

    chatWindow.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem; color: #64748b; font-size: 0.85rem;">
        <span class="status-dot" style="background:#10b981; display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; animation: pulse 1.5s infinite;"></span>
        <em>${forceReset ? '🔄 Reiniciando chat con Apolo y limpiando datos previos...' : 'Cargando conversación del simulador...'}</em>
      </div>
    `;

    try {
      const endpoint = forceReset ? '/api/simulator/reset' : '/api/simulator/init';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: cleanPhone, reset: forceReset })
      });
      const data = await res.json();

      chatWindow.innerHTML = '';

      if (data.messages && data.messages.length > 0) {
        data.messages.forEach(msg => {
          const senderType = msg.sender === 'user' ? 'user' : (msg.sender === 'advisor' ? 'advisor' : 'bot');
          appendBubble(msg.content, senderType, msg.timestamp);
        });
      } else if (data.replyText) {
        appendBubble(data.replyText, 'bot');
      }

      if (simMessageInput) simMessageInput.value = '';

      if (simFeedback) {
        simFeedback.innerHTML = `
          <span style="color: #059669; font-weight: 600; display: inline-flex; align-items: center; gap: 0.35rem;">
            <svg class="mini-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            ${forceReset ? 'Chat reiniciado exitosamente. Asistente Apolo listo para pruebas.' : 'Asistente IA Apolo en línea y listo para responder autónomamente.'}
          </span>
        `;
      }

      chatWindow.scrollTop = chatWindow.scrollHeight;
      fetchLeads();
      loadTelemetry();
    } catch (err) {
      chatWindow.innerHTML = '';
      appendBubble(`¡Hola! 👋 Te damos la bienvenida al *Centro de Extensión de la Facultad de Medicina UdeA* 🩺✨.\n\n¿En cuál de nuestros programas te gustaría conocer fechas oficiales e inversión?`, 'bot');
    } finally {
      if (btnSimResetChat) {
        btnSimResetChat.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
          <span>Reiniciar</span>
        `;
      }
    }
  }

  async function sendSimulatorMessage(messageText) {
    if (!chatWindow) return;
    const phone = (simPhoneInput ? simPhoneInput.value : '+573001234567').trim() || '+573001234567';
    const message = (messageText !== undefined ? messageText : (simMessageInput ? simMessageInput.value : '')).trim();
    if (!message) return;

    appendBubble(message, 'user');
    if (simMessageInput) simMessageInput.value = '';

    const typingBubble = document.createElement('div');
    typingBubble.className = 'wa-bubble bot';
    typingBubble.innerHTML = '<em>Escribiendo respuesta oficial de Medicina UdeA... 🩺</em>';
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

      if (data && data.replyText) {
        appendBubble(data.replyText, 'bot');
      } else {
        appendBubble('¡Hola! Con gusto te oriento en tus dudas sobre los programas de la Facultad de Medicina UdeA. 🩺', 'bot');
      }

      if (simFeedback) {
        if (data.requestAdvisor) {
          simFeedback.innerHTML = `
            <span style="color: #dc2626; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem;">
              <svg class="mini-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Solicitud de Asesor Activada
            </span>
            <br>El bot identificó una solicitud de asesoría especializada y priorizó al contacto en el CRM.
          `;
        } else {
          simFeedback.innerHTML = `
            <span style="color: #059669; font-weight: 600; display: inline-flex; align-items: center; gap: 0.35rem;">
              <svg class="mini-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Respuesta autónoma generada exitosamente.
            </span>
            <br>Perfil detectado: <strong>${escapeHtml(data.segmentation ? data.segmentation.segment_profession || data.segmentation.profession || 'Salud' : 'Salud')}</strong> · Nivel de Interés: <strong>${data.segmentation ? data.segmentation.interest_temperature || 'Activo' : 'Activo'}</strong>.
          `;
        }
      }

      loadTelemetry();
      fetchLeads();
    } catch (err) {
      typingBubble.remove();
      appendBubble(`Error de conexión al procesar mensaje: ${err.message}`, 'bot');
    }
  }

  function appendBubble(text, sender, timestamp) {
    if (!chatWindow) return;
    const bubble = document.createElement('div');
    bubble.className = `wa-bubble ${sender}`;
    const time = timestamp
      ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    bubble.innerHTML = `${formatWhatsAppText(text)}<div class="wa-time">${time}</div>`;
    chatWindow.appendChild(bubble);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function formatWhatsAppText(text) {
    if (!text) return '';
    return text.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
  }

  if (simulatorForm) {
    simulatorForm.addEventListener('submit', (e) => {
      e.preventDefault();
      sendSimulatorMessage();
    });
  }

  if (btnSimResetChat) {
    btnSimResetChat.addEventListener('click', () => {
      loadSimulatorChat(simPhoneInput ? simPhoneInput.value : null, true);
    });
  }

  if (btnSimNewConversation) {
    btnSimNewConversation.addEventListener('click', () => {
      loadSimulatorChat(simPhoneInput ? simPhoneInput.value : null, true);
    });
  }

  if (btnQuickInitChat) {
    btnQuickInitChat.addEventListener('click', () => {
      loadSimulatorChat(simPhoneInput ? simPhoneInput.value : null, true);
    });
  }

  if (simPhoneInput) {
    simPhoneInput.addEventListener('change', () => {
      loadSimulatorChat(simPhoneInput.value, false);
    });
  }

  quickPromptButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.id === 'btnQuickInitChat') return;
      const msg = btn.getAttribute('data-msg');
      if (msg) {
        sendSimulatorMessage(msg);
      }
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
          <div class="card-footer" style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span class="card-investment">${safeInvest}</span>
            <div style="display:flex; gap:0.4rem; align-items:center;">
              <a href="${safeLink}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" title="Página web de información en Extensión UdeA">
                <span>Información</span>
              </a>
              ${item.payment_link ? `
                <a href="${encodeURI(item.payment_link)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm" style="background:#047857; border-color:#047857; padding:0.35rem 0.65rem;" title="Enlace directo del botón de Inscripciones / Pago UdeA">
                  <span>Inscripción</span>
                  <svg class="mini-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </a>
              ` : ''}
            </div>
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
        const token = localStorage.getItem('udea_auth_token');
        const res = await fetch('/api/knowledge/sync', { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
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

  // Descarga autorizada de base de datos segmentada
  const btnExportCsv = document.getElementById('btnExportCsv');
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', (e) => {
      const token = localStorage.getItem('udea_auth_token');
      if (token) {
        btnExportCsv.href = `/api/segmentation/export?token=${encodeURIComponent(token)}`;
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
        registration_link: (document.getElementById('courseRegLink') && document.getElementById('courseRegLink').value.trim()) || 'https://extension.medicinaudea.co',
        payment_link: (document.getElementById('coursePaymentLink') && document.getElementById('coursePaymentLink').value.trim()) || (document.getElementById('courseRegLink') && document.getElementById('courseRegLink').value.trim()) || 'https://extension.medicinaudea.co/oferta-academica/',
        contact_email: 'aprendizajes.med@udea.edu.co'
      };

      try {
        const token = localStorage.getItem('udea_auth_token');
        const res = await fetch('/api/knowledge', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
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
  const btnSaveGeminiKey = document.getElementById('btnSaveGeminiKey');
  const geminiKeyInput = document.getElementById('geminiKeyInput');
  const geminiKeyStatus = document.getElementById('geminiKeyStatus');
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
          geminiKeyStatus.textContent = 'Clave activada. Cascada multi-modelo activa (Gemini 3.5 Flash-Lite, 3.1 Flash-Lite, 3.5 Flash y 3.8 Flash).';
          geminiKeyInput.value = '';
          loadTelemetry();
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }

  // Guardar y Cargar Configuración de Firebase Auth
  const firebaseApiKeyInput = document.getElementById('firebaseApiKeyInput');
  const firebaseAuthDomainInput = document.getElementById('firebaseAuthDomainInput');
  const firebaseProjectIdInput = document.getElementById('firebaseProjectIdInput');
  const btnSaveFirebaseConfig = document.getElementById('btnSaveFirebaseConfig');
  const firebaseConfigStatus = document.getElementById('firebaseConfigStatus');

  const existingFbConfig = JSON.parse(localStorage.getItem('udea_firebase_config') || 'null');
  if (existingFbConfig) {
    if (firebaseApiKeyInput && existingFbConfig.apiKey) firebaseApiKeyInput.value = existingFbConfig.apiKey;
    if (firebaseAuthDomainInput && existingFbConfig.authDomain) firebaseAuthDomainInput.value = existingFbConfig.authDomain;
    if (firebaseProjectIdInput && existingFbConfig.projectId) firebaseProjectIdInput.value = existingFbConfig.projectId;
  }

  if (btnSaveFirebaseConfig) {
    btnSaveFirebaseConfig.addEventListener('click', async () => {
      const apiKey = firebaseApiKeyInput ? firebaseApiKeyInput.value.trim() : '';
      const authDomain = firebaseAuthDomainInput ? firebaseAuthDomainInput.value.trim() : '';
      const projectId = firebaseProjectIdInput ? firebaseProjectIdInput.value.trim() : '';

      if (!apiKey || !projectId) {
        alert('Por favor ingresa al menos la API Key y el Project ID de Firebase.');
        return;
      }

      const config = { apiKey, authDomain, projectId };
      localStorage.setItem('udea_firebase_config', JSON.stringify(config));

      if (firebaseConfigStatus) {
        firebaseConfigStatus.textContent = 'Configuración de Firebase guardada. Conectando con Firebase Auth...';
        firebaseConfigStatus.style.color = '#059669';
      }

      await initFirebaseClient();
      alert('¡Configuración de Firebase guardada y activada con éxito!');
    });
  }

  // Filtros CRM
  if (crmFilterSelect) crmFilterSelect.addEventListener('change', renderLeads);
  if (crmAdvisorFilter) crmAdvisorFilter.addEventListener('change', renderLeads);
  if (crmTempFilter) crmTempFilter.addEventListener('change', renderLeads);
  if (crmSearchInput) crmSearchInput.addEventListener('input', renderLeads);
  if (btnRefreshLeads) btnRefreshLeads.addEventListener('click', () => { fetchLeads(); loadTelemetry(); });
  if (btnGlobalRefresh) btnGlobalRefresh.addEventListener('click', () => { fetchLeads(); fetchPortfolio(); loadTelemetry(); });

  // ========================================================
  // PANEL DE CONTROL Y ADMINISTRACIÓN TIC (EXCLUSIVO SUPER ADMIN)
  // ========================================================
  async function loadSystemAdminMetrics() {
    try {
      const token = localStorage.getItem('udea_auth_token');
      const url = token ? `/api/admin/system-stats?token=${encodeURIComponent(token)}` : '/api/admin/system-stats';
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) {
        console.warn('Acceso no autorizado o error al cargar métricas del sistema:', res.status);
        const errJson = await res.json().catch(() => ({}));
        if (document.getElementById('sysServerUptime')) {
          document.getElementById('sysServerUptime').textContent = errJson.error || 'Error de autorización TIC';
        }
        return;
      }
      const data = await res.json();

      // 1. Base de Datos
      const dbData = data.database;
      if (document.getElementById('sysDbSize')) document.getElementById('sysDbSize').textContent = dbData.sizeFormatted || '--';
      if (document.getElementById('sysDbPath')) document.getElementById('sysDbPath').textContent = dbData.filePath || '--';
      if (document.getElementById('sysDbLeads')) document.getElementById('sysDbLeads').textContent = dbData.tables.leads.total;
      if (document.getElementById('sysDbMessages')) document.getElementById('sysDbMessages').textContent = dbData.tables.messages.total;
      if (document.getElementById('sysDbCourses')) document.getElementById('sysDbCourses').textContent = dbData.tables.knowledge.total;
      if (document.getElementById('sysDbPaymentLinks')) document.getElementById('sysDbPaymentLinks').textContent = dbData.tables.knowledge.withPaymentLink;
      if (document.getElementById('sysDbAdvisors')) document.getElementById('sysDbAdvisors').textContent = dbData.tables.advisorsCount;
      if (document.getElementById('sysDbAuditCount')) document.getElementById('sysDbAuditCount').textContent = dbData.tables.totalAuditLogs;

      // Capacidad de Almacenamiento Neon / Postgres
      if (dbData.storage) {
        const s = dbData.storage;
        if (document.getElementById('sysDbCapacityBar')) {
          document.getElementById('sysDbCapacityBar').style.width = `${Math.min(100, Math.max(1, s.usagePercent || 1.6))}%`;
        }
        if (document.getElementById('sysDbCapacityLabel')) {
          document.getElementById('sysDbCapacityLabel').textContent = s.sizeFormatted || `${s.sizePretty} / 1 GB`;
        }
        if (document.getElementById('sysDbCapacityPercent')) {
          document.getElementById('sysDbCapacityPercent').textContent = `${s.usagePercent}% de cuota (${s.remainingMb || '1015.5'} MB libres)`;
        }
      }
      if (document.getElementById('sysDbEngineTitle')) {
        document.getElementById('sysDbEngineTitle').textContent = dbData.isCloud ? 'Base de Datos PostgreSQL (Neon Cloud)' : 'Base de Datos SQLite (Local)';
      }
      if (document.getElementById('sysDbEngineBadge')) {
        document.getElementById('sysDbEngineBadge').textContent = dbData.isCloud ? 'Neon Serverless' : 'SQLite Local';
      }

      // 2. IA y Tokens
      const aiData = data.ai;
      if (document.getElementById('sysAiTotalTokens')) document.getElementById('sysAiTotalTokens').textContent = (aiData.totalEstimatedTokens || 0).toLocaleString();
      if (document.getElementById('sysAiInTokens')) document.getElementById('sysAiInTokens').textContent = (aiData.estimatedInputTokens || 0).toLocaleString();
      if (document.getElementById('sysAiOutTokens')) document.getElementById('sysAiOutTokens').textContent = (aiData.estimatedOutputTokens || 0).toLocaleString();
      if (document.getElementById('sysAiSuccessCalls')) document.getElementById('sysAiSuccessCalls').textContent = aiData.geminiSuccess || 0;
      if (document.getElementById('sysAiLocalCalls')) document.getElementById('sysAiLocalCalls').textContent = aiData.localFallback || 0;
      if (document.getElementById('sysAiLastModel')) document.getElementById('sysAiLastModel').textContent = aiData.lastUsedModel || 'Ninguno aún';
      if (document.getElementById('sysAiKeyStatus')) document.getElementById('sysAiKeyStatus').textContent = aiData.hasApiKey ? 'Activa y Configurada ✅' : 'Sin Configurar (Modo Contingencia)';

      const poolContainer = document.getElementById('sysAiModelPoolContainer');
      if (poolContainer && aiData.activeModelPool) {
        poolContainer.innerHTML = aiData.activeModelPool.map(m => {
          const isActive = m === aiData.lastUsedModel;
          const count = (aiData.modelStats && aiData.modelStats[m]) ? ` (${aiData.modelStats[m]})` : '';
          return `<span class="model-chip ${isActive ? 'active' : ''}">${escapeHtml(m)}${count}</span>`;
        }).join('');
      }

      // 3. WhatsApp y Meta Facturación
      const waData = data.whatsapp;
      if (document.getElementById('sysWaConversations')) document.getElementById('sysWaConversations').textContent = `${waData.conversationsMonth} / ${waData.monthlyLimit}`;
      if (document.getElementById('sysWaPercent')) document.getElementById('sysWaPercent').textContent = `${waData.usagePercent}%`;
      const pBar = document.getElementById('sysWaProgressBar');
      if (pBar) pBar.style.width = `${Math.min(100, waData.usagePercent)}%`;
      if (document.getElementById('sysWaKillSwitch')) document.getElementById('sysWaKillSwitch').textContent = waData.killSwitchStatus;
      if (document.getElementById('sysWaPhoneId')) document.getElementById('sysWaPhoneId').textContent = waData.metaPhoneId;
      if (document.getElementById('sysWaWabaId')) document.getElementById('sysWaWabaId').textContent = waData.metaWabaId;

      // 4. Recursos del Servidor
      const srvData = data.server;
      if (document.getElementById('sysServerEnv')) document.getElementById('sysServerEnv').textContent = srvData.environment;
      if (document.getElementById('sysServerUptime')) document.getElementById('sysServerUptime').textContent = `Uptime: ${srvData.uptimeFormatted}`;
      if (document.getElementById('sysHeapMemory')) document.getElementById('sysHeapMemory').textContent = `${srvData.heapUsedMb} MB`;
      if (document.getElementById('sysHeapTotal')) document.getElementById('sysHeapTotal').textContent = `${srvData.heapTotalMb} MB`;
      if (document.getElementById('sysRssMemory')) document.getElementById('sysRssMemory').textContent = `${srvData.rssMb} MB`;
      if (document.getElementById('sysNodeVer')) document.getElementById('sysNodeVer').textContent = srvData.nodeVersion;
      if (document.getElementById('sysUptimeDetail')) document.getElementById('sysUptimeDetail').textContent = srvData.uptimeFormatted;

      // 5. Tabla de Auditoría & Trazabilidad (Diseño Profesional Senior)
      const auditTableBody = document.getElementById('sysAuditTableBody');
      const auditBadge = document.getElementById('sysAuditBadgeCount');
      if (auditBadge) auditBadge.textContent = `${data.auditLogs.length} Registros Recientes`;
      if (auditTableBody) {
        if (!data.auditLogs || data.auditLogs.length === 0) {
          auditTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-muted);">No hay eventos de auditoría registrados.</td></tr>';
        } else {
          auditTableBody.innerHTML = data.auditLogs.map(log => renderAuditLogRow(log)).join('');
        }
      }

      // Sincronizar también respuestas rápidas en el panel administrativo
      loadCannedResponses();
    } catch (err) {
      console.error('Error al cargar métricas del sistema:', err);
    }
  }

  // Formateador Senior de Filas de Bitácora (Elegante, sin roturas de línea, con chips)
  function renderAuditLogRow(log) {
    const idBadge = `<span class="audit-id-badge">#${log.id}</span>`;
    
    // Fecha y hora en 1 sola línea (evita que "p. m." caiga en otra línea)
    const d = new Date(log.timestamp);
    const dateStr = d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const formattedDate = `<div class="audit-time-cell"><span class="audit-date">${dateStr}</span> <span class="audit-hour">${timeStr}</span></div>`;
    
    // Badge de Evento semántico
    let eventBadge = '';
    const ev = (log.event || '').toUpperCase();
    if (ev.includes('ATTENDED')) {
      eventBadge = `<span class="audit-event-badge attended">Atención Asesor</span>`;
    } else if (ev.includes('ASSIGNED')) {
      eventBadge = `<span class="audit-event-badge assigned">Asignación Asesor</span>`;
    } else if (ev.includes('POSTGRES') || ev.includes('DB') || ev.includes('SQLITE')) {
      eventBadge = `<span class="audit-event-badge db">Neon Postgres</span>`;
    } else if (ev.includes('CANNED')) {
      eventBadge = `<span class="audit-event-badge macro">Plantilla CRM</span>`;
    } else if (ev.includes('AI') || ev.includes('GEMINI')) {
      eventBadge = `<span class="audit-event-badge ai">IA Apolo</span>`;
    } else if (ev.includes('BACKUP')) {
      eventBadge = `<span class="audit-event-badge backup">Copia Respaldo</span>`;
    } else {
      eventBadge = `<span class="audit-event-badge generic">${escapeHtml(ev.replace(/_/g, ' '))}</span>`;
    }

    // Detalles técnicos: Extraer datos a chips visuales limpios en lugar de JSON crudo
    let detailsHtml = '';
    const rawDetails = log.details || '';
    try {
      let parsed = null;
      if (typeof rawDetails === 'string' && rawDetails.trim().startsWith('{')) {
        parsed = JSON.parse(rawDetails);
      } else if (typeof rawDetails === 'object' && rawDetails !== null) {
        parsed = rawDetails;
      }

      if (parsed) {
        const chips = [];
        if (parsed.phone) {
          const cleanPh = parsed.phone.replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, '+$1 $2 $3 $4');
          chips.push(`<span class="audit-detail-chip phone">📞 ${escapeHtml(cleanPh)}</span>`);
        }
        if (parsed.advisor) {
          chips.push(`<span class="audit-detail-chip advisor">👤 Asesor: ${escapeHtml(parsed.advisor)}</span>`);
        }
        if (parsed.title || parsed.shortcut) {
          chips.push(`<span class="audit-detail-chip macro">🏷️ ${escapeHtml(parsed.shortcut || parsed.title)}</span>`);
        }
        if (parsed.count !== undefined) {
          chips.push(`<span class="audit-detail-chip count">📦 ${parsed.count} items</span>`);
        }
        if (chips.length > 0) {
          detailsHtml = `<div class="audit-chips-row">${chips.join(' ')}</div>`;
        } else {
          detailsHtml = `<span class="audit-text-desc">${escapeHtml(JSON.stringify(parsed))}</span>`;
        }
      } else {
        detailsHtml = `<span class="audit-text-desc">${escapeHtml(rawDetails)}</span>`;
      }
    } catch (e) {
      detailsHtml = `<span class="audit-text-desc">${escapeHtml(rawDetails)}</span>`;
    }

    return `
      <tr>
        <td style="text-align:center; width:65px;">${idBadge}</td>
        <td style="width:190px;">${formattedDate}</td>
        <td style="width:180px;">${eventBadge}</td>
        <td>${detailsHtml}</td>
      </tr>
    `;
  }

  const btnRefreshSystemStats = document.getElementById('btnRefreshSystemStats');
  if (btnRefreshSystemStats) {
    btnRefreshSystemStats.addEventListener('click', () => {
      btnRefreshSystemStats.classList.add('loading');
      loadSystemAdminMetrics().finally(() => {
        btnRefreshSystemStats.classList.remove('loading');
      });
    });
  }

  const btnForceBackup = document.getElementById('btnForceBackup');
  if (btnForceBackup) {
    btnForceBackup.addEventListener('click', async () => {
      try {
        btnForceBackup.disabled = true;
        const token = localStorage.getItem('udea_auth_token');
        const res = await fetch('/api/admin/backup-now', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
        const data = await res.json();
        if (data.success) {
          alert(`Respaldo persistente generado con éxito: ${data.count} programas guardados en JSON para Vercel.`);
          loadSystemAdminMetrics();
        } else {
          alert('Error al generar respaldo: ' + (data.error || 'Desconocido'));
        }
      } catch (e) {
        alert('Error de conexión: ' + e.message);
      } finally {
        btnForceBackup.disabled = false;
      }
    });
  }

  const btnAdminSyncWebPortfolio = document.getElementById('btnAdminSyncWebPortfolio');
  if (btnAdminSyncWebPortfolio) {
    btnAdminSyncWebPortfolio.addEventListener('click', () => {
      if (btnSyncWeb) {
        btnSyncWeb.click();
      }
    });
  }

  // ==========================================================================
  // 12. BANDEJA DEL ASESOR · AGENT WORKSPACE 3-COLUMN (ESTILO ZENDESK / INTERCOM)
  // Consola Omnicanal: Cola de Triage, Feed en Vivo WhatsApp y Customer 360
  // ==========================================================================

  // ==========================================================================
  // GESTIÓN DINÁMICA DE RESPUESTAS RÁPIDAS & PLANTILLAS EN TIEMPO REAL
  // Sincronización transparente con Neon PostgreSQL y Bandeja del Asesor
  // ==========================================================================
  let allCannedResponses = [];

  // Función para auto-expandir el textarea del asesor sin tapar la pantalla
  function autoResizeComposerTextarea() {
    if (!inboxMessageInput) return;
    inboxMessageInput.style.height = 'auto';
    const scrollH = inboxMessageInput.scrollHeight;
    // Crece progresivamente de 52px (2 líneas) hasta 150px (alrededor de 6 líneas de texto cómodas)
    const targetHeight = Math.min(Math.max(scrollH, 52), 150);
    inboxMessageInput.style.height = targetHeight + 'px';
  }

  // Cargar respuestas rápidas desde el backend
  async function loadCannedResponses() {
    try {
      const res = await fetch('/api/canned-responses');
      const data = await res.json();
      const list = data.responses || data.macros || [];
      if (data.success && Array.isArray(list)) {
        allCannedResponses = list;
        renderInboxMacros();
        renderCannedResponsesTable();
      }
    } catch (err) {
      console.warn('Error al sincronizar respuestas rápidas:', err);
    }
  }

  // Renderizar chips de respuesta rápida en la barra del chat
  function renderInboxMacros() {
    const container = document.getElementById('inboxMacrosContainer');
    if (!container) return;
    if (allCannedResponses.length === 0) {
      container.innerHTML = '<span style="font-size:0.7rem; color:var(--text-muted); padding:0.2rem 0.5rem;">Sin respuestas configuradas</span>';
      return;
    }
    container.innerHTML = allCannedResponses.map(m => {
      const safeShortcut = escapeHtml(m.shortcut || m.title);
      const safeTitle = escapeHtml(m.title);
      return `<button type="button" class="macro-chip" data-id="${m.id}" title="${safeTitle}">${safeShortcut}</button>`;
    }).join('');

    // Asignar evento de inserción inmediata a cada botón
    container.querySelectorAll('.macro-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const mId = chip.getAttribute('data-id');
        const found = allCannedResponses.find(r => r.id === mId);
        if (found && inboxMessageInput) {
          if (inboxMessageInput.value.trim().length > 0) {
            inboxMessageInput.value += '\n\n' + found.message;
          } else {
            inboxMessageInput.value = found.message;
          }
          autoResizeComposerTextarea();
          inboxMessageInput.focus();
          inboxMessageInput.scrollTop = inboxMessageInput.scrollHeight;
        }
      });
    });
  }

  // Renderizar tabla administrativa de respuestas rápidas en el Panel TIC
  function renderCannedResponsesTable() {
    const tbody = document.getElementById('cannedResponsesTableBody');
    const countBadge = document.getElementById('cannedCountBadge');
    if (countBadge) {
      countBadge.textContent = `${allCannedResponses.length} Plantillas`;
    }
    if (!tbody) return;
    if (allCannedResponses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:2rem; color:var(--text-muted);">No hay plantillas creadas. Agrega una con el botón "+ Nueva Plantilla".</td></tr>';
      return;
    }
    tbody.innerHTML = allCannedResponses.map(m => {
      const categoryLabel = m.category ? escapeHtml(m.category) : 'General';
      const cleanShortcut = escapeHtml(m.shortcut || m.title);
      const cleanTitle = escapeHtml(m.title);
      const cleanMessage = escapeHtml(m.message);

      return `
        <tr>
          <td>
            <span class="macro-shortcut-tag" title="Atajo para el asesor">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              ${cleanShortcut}
            </span>
          </td>
          <td>
            <div class="macro-title-cell">
              <span class="macro-title-text">${cleanTitle}</span>
              <span class="macro-cat-pill">${categoryLabel}</span>
            </div>
          </td>
          <td>
            <div class="macro-msg-bubble" title="${cleanMessage}">
              ${cleanMessage}
            </div>
          </td>
          <td>
            <div class="macro-action-btns">
              <button class="btn-macro-edit" onclick="window.editCannedResponse('${m.id}')" title="Editar plantilla">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                Editar
              </button>
              <button class="btn-macro-delete" onclick="window.deleteCannedResponse('${m.id}')" title="Eliminar plantilla">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  let currentInboxPhone = null;
  let currentInboxLead = null;
  let currentInboxFilter = 'all'; // 'all', 'mine', 'hot', 'needs_human'
  let currentInboxSearch = '';

  // Elementos de la Bandeja de Entrada
  const inboxTotalCountBadge = document.getElementById('inboxTotalCountBadge');
  const inboxSearchInput = document.getElementById('inboxSearchInput');
  const inboxConversationsList = document.getElementById('inboxConversationsList');
  const inboxTriagePills = document.querySelectorAll('.inbox-triage-pills .triage-pill');

  // Elementos de la Columna Central (Chat Feed)
  const inboxChatHeader = document.getElementById('inboxChatHeader');
  const inboxActiveAvatar = document.getElementById('inboxActiveAvatar');
  const inboxActiveName = document.getElementById('inboxActiveName');
  const inboxActiveTempBadge = document.getElementById('inboxActiveTempBadge');
  const inboxActivePhone = document.getElementById('inboxActivePhone');
  const inboxActiveStatus = document.getElementById('inboxActiveStatus');
  const inboxAiToggleCheck = document.getElementById('inboxAiToggleCheck');
  const inboxAiToggleLabel = document.getElementById('inboxAiToggleLabel');
  const btnInboxMarkAttended = document.getElementById('btnInboxMarkAttended');
  const inboxMessagesFeed = document.getElementById('inboxMessagesFeed');
  const inboxComposer = document.getElementById('inboxComposer');
  const inboxMessageInput = document.getElementById('inboxMessageInput');
  const btnInboxSendMessage = document.getElementById('btnInboxSendMessage');
  const macroChips = document.querySelectorAll('.macros-bar .macro-chip');

  // Elementos de la Columna Derecha (Customer 360)
  const inboxCustomerPanel = document.getElementById('inboxCustomerPanel');
  const inboxCustAvatar = document.getElementById('inboxCustAvatar');
  const inboxCustName = document.getElementById('inboxCustName');
  const inboxCustPhone = document.getElementById('inboxCustPhone');
  const inboxCustWaLink = document.getElementById('inboxCustWaLink');
  const inboxCustDoc = document.getElementById('inboxCustDoc');
  const inboxCustEmail = document.getElementById('inboxCustEmail');
  const inboxCustProfession = document.getElementById('inboxCustProfession');
  const inboxCustArea = document.getElementById('inboxCustArea');
  const inboxCustProgram = document.getElementById('inboxCustProgram');
  const btnInboxCopyPaymentLink = document.getElementById('btnInboxCopyPaymentLink');
  const inboxCustPaymentDirectLink = document.getElementById('inboxCustPaymentDirectLink');
  const inboxCustInfoLink = document.getElementById('inboxCustInfoLink');
  const inboxCustStatusSelect = document.getElementById('inboxCustStatusSelect');
  const inboxCustAdvisorSelect = document.getElementById('inboxCustAdvisorSelect');
  const btnInboxAssignToMe = document.getElementById('btnInboxAssignToMe');
  const inboxCustTempSelect = document.getElementById('inboxCustTempSelect');
  const inboxCustNotesTextarea = document.getElementById('inboxCustNotesTextarea');
  const btnInboxSaveNotes = document.getElementById('btnInboxSaveNotes');
  const inboxNotesSavedStatus = document.getElementById('inboxNotesSavedStatus');

  // Filtros tipo píldora de la cola de triage
  inboxTriagePills.forEach(pill => {
    pill.addEventListener('click', () => {
      inboxTriagePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentInboxFilter = pill.getAttribute('data-filter') || 'all';
      renderInbox(true);
    });
  });

  // Buscador reactivo en tiempo real
  if (inboxSearchInput) {
    inboxSearchInput.addEventListener('input', (e) => {
      currentInboxSearch = (e.target.value || '').toLowerCase().trim();
      renderInbox(true);
    });
  }

  // Cargar y renderizar la columna 1 (Lista de conversaciones)
  function renderInbox(preserveSelection = false) {
    if (!inboxConversationsList) return;

    const myAdvisor = getActiveAdvisor();
    let list = [...allLoadedLeads];

    // Aplicar filtro de Triage
    if (currentInboxFilter === 'mine') {
      list = list.filter(l => (l.assigned_advisor || '') === myAdvisor);
    } else if (currentInboxFilter === 'hot') {
      list = list.filter(l => l.interest_temperature === 'hot');
    } else if (currentInboxFilter === 'needs_human') {
      list = list.filter(l => l.status === 'advisor_requested');
    } else if (currentInboxFilter === 'attended') {
      list = list.filter(l => l.status === 'attended' || !!l.attended_by);
    }

    // Aplicar búsqueda por texto
    if (currentInboxSearch) {
      list = list.filter(l =>
        (l.name && l.name.toLowerCase().includes(currentInboxSearch)) ||
        (l.phone_number && l.phone_number.includes(currentInboxSearch)) ||
        (l.program_interest && l.program_interest.toLowerCase().includes(currentInboxSearch)) ||
        (l.segment_profession && l.segment_profession.toLowerCase().includes(currentInboxSearch)) ||
        (l.last_message && l.last_message.toLowerCase().includes(currentInboxSearch))
      );
    }

    if (inboxTotalCountBadge) {
      inboxTotalCountBadge.textContent = `${list.length} chat${list.length === 1 ? '' : 's'}`;
    }

    if (list.length === 0) {
      inboxConversationsList.innerHTML = `
        <div style="padding: 2.5rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.82rem;">
          <div style="font-size: 1.8rem; margin-bottom: 0.5rem; opacity: 0.6;">📭</div>
          <strong>No hay conversaciones</strong>
          <p style="margin: 0.25rem 0 0; font-size: 0.74rem;">No hay prospectos que coincidan con los filtros seleccionados.</p>
        </div>
      `;
      if (!preserveSelection) {
        resetInboxView();
      }
      return;
    }

    inboxConversationsList.innerHTML = list.map(lead => {
      const isSelected = lead.phone_number === currentInboxPhone;
      const initials = getInitials(lead.name || 'Interesado UdeA');
      const tempClass = lead.interest_temperature || 'cold';
      const tempLabel = tempClass === 'hot' ? 'Prioridad Alta' : (tempClass === 'warm' ? 'Prioridad Media' : 'Prioridad Estándar');
      const safeName = escapeHtml(lead.name || 'Interesado UdeA');
      const safeMsg = escapeHtml(lead.last_message || 'Inició conversación...');
      const safePhone = escapeHtml(lead.phone_number || '');
      const timeStr = lead.updated_at ? new Date(lead.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const isUrgent = lead.status === 'advisor_requested';
      const isAttended = lead.status === 'attended' || !!lead.attended_by;

      return `
        <div class="inbox-conv-item ${isSelected ? 'active' : ''} ${isUrgent ? 'unread' : ''}" onclick="window.selectInboxLead('${safePhone}')">
          <div class="conv-avatar">${initials}</div>
          <div class="conv-body">
            <div class="conv-top">
              <span class="conv-name">${safeName}</span>
              <span class="conv-time">${timeStr}</span>
            </div>
            <div class="conv-preview">${safeMsg}</div>
            <div class="conv-tags">
              <span class="conv-tag temp ${tempClass}">${tempLabel}</span>
              ${isUrgent ? `<span class="conv-tag req">🚨 Requiere Asesor</span>` : ''}
              ${isAttended ? `<span class="conv-tag attended">✓ Atendido</span>` : ''}
              ${lead.assigned_advisor && lead.assigned_advisor !== 'Sin Asignar' ? `<span class="conv-tag" style="background:#f1f5f9; color:#475569;">👤 ${escapeHtml(lead.assigned_advisor)}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Si había un lead seleccionado o si ninguno lo está y hay elementos en la lista, abrir el primero si no hay selección previa
    if (currentInboxPhone && list.some(l => l.phone_number === currentInboxPhone)) {
      // Mantener selección activa
    } else if (!currentInboxPhone && list.length > 0 && !preserveSelection) {
      selectInboxLead(list[0].phone_number);
    }
  }

  function resetInboxView() {
    currentInboxPhone = null;
    if (inboxChatHeader) inboxChatHeader.style.display = 'none';
    if (inboxComposer) inboxComposer.style.display = 'none';
    if (inboxCustomerPanel) inboxCustomerPanel.style.display = 'none';
    if (inboxMessagesFeed) {
      inboxMessagesFeed.innerHTML = `
        <div class="workspace-no-chat-selected">
          <div class="no-chat-icon">💬</div>
          <h3>Bandeja de Conversaciones WhatsApp</h3>
          <p>Selecciona un prospecto en la columna izquierda para abrir su chat en tiempo real, enviar respuestas oficiales y gestionar su matrícula.</p>
        </div>
      `;
    }
  }

  function getInitials(name) {
    if (!name) return 'UD';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  // 13. Abrir y Cargar Chat de un Prospecto en el Workspace
  window.selectInboxLead = async (phone) => {
    currentInboxPhone = phone;
    
    // Destacar en la lista lateral
    document.querySelectorAll('.inbox-conv-item').forEach(el => el.classList.remove('active'));
    renderInbox(true);

    // Mostrar contenedores de trabajo
    if (inboxChatHeader) inboxChatHeader.style.display = 'flex';
    if (inboxComposer) inboxComposer.style.display = 'flex';
    if (inboxCustomerPanel) inboxCustomerPanel.style.display = 'flex';

    if (inboxMessagesFeed) {
      inboxMessagesFeed.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-muted); font-size:0.85rem;">
          <div class="spinner-mini" style="margin-bottom:0.75rem;"></div>
          <span>Cargando mensajes de WhatsApp...</span>
        </div>
      `;
    }

    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(phone)}/chat`);
      const data = await res.json();
      const messages = data.messages || [];
      const lead = data.lead || {};
      currentInboxLead = lead;

      // Actualizar Header del Chat (Columna 2)
      const initials = getInitials(lead.name || 'Interesado UdeA');
      if (inboxActiveAvatar) inboxActiveAvatar.textContent = initials;
      if (inboxActiveName) inboxActiveName.textContent = lead.name || 'Interesado UdeA';
      if (inboxActivePhone) inboxActivePhone.textContent = lead.phone_number || '';
      if (inboxActiveStatus) {
        if (lead.status === 'attended' || lead.attended_by) {
          inboxActiveStatus.textContent = `✓ Atendido (${lead.attended_by || 'Asesor'})`;
        } else if (lead.status === 'advisor_requested') {
          inboxActiveStatus.textContent = '🚨 Espera asesor';
        } else if (lead.status === 'advisor_handling') {
          inboxActiveStatus.textContent = '👨‍⚕️ Asesor al mando';
        } else {
          inboxActiveStatus.textContent = '🤖 IA Apolo';
        }
      }
      updateInboxAttendedButtonState(lead);

      if (inboxActiveTempBadge) {
        const temp = lead.interest_temperature || 'cold';
        inboxActiveTempBadge.className = `priority-badge ${temp}`;
        inboxActiveTempBadge.textContent = temp === 'hot' ? 'Prioridad Alta' : (temp === 'warm' ? 'Prioridad Media' : 'Prioridad Estándar');
      }

      // Configurar Toggle de IA
      const isAiActive = lead.status !== 'advisor_handling';
      if (inboxAiToggleCheck) inboxAiToggleCheck.checked = isAiActive;
      if (inboxAiToggleLabel) {
        inboxAiToggleLabel.textContent = isAiActive ? '🤖 IA Activa' : '⏸️ IA Pausada (Asesor)';
        inboxAiToggleLabel.style.color = isAiActive ? 'var(--udea-emerald)' : '#ea580c';
      }

      // Renderizar Feed de Mensajes estilo WhatsApp
      if (inboxMessagesFeed) {
        if (messages.length === 0) {
          inboxMessagesFeed.innerHTML = `
            <div style="text-align:center; padding:3rem 1rem; color:var(--text-muted); font-size:0.84rem;">
              <p>No hay mensajes registrados aún en este chat.</p>
              <p style="font-size:0.75rem;">Usa las respuestas rápidas o escribe abajo para iniciar la conversación.</p>
            </div>
          `;
        } else {
          inboxMessagesFeed.innerHTML = messages.map(m => {
            const isUser = m.sender === 'user';
            const isAdvisor = m.sender === 'advisor';
            const senderClass = isUser ? 'user' : (isAdvisor ? 'advisor' : 'bot');
            const senderTag = isUser ? '👤 Prospecto' : (isAdvisor ? '👨‍⚕️ Asesor Humano UdeA' : '🤖 Asistente Apolo (IA)');
            const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const safeContent = escapeHtml(m.content);

            return `
              <div class="wa-bubble ${senderClass}">
                <div class="wa-bubble-sender">${senderTag}</div>
                <div class="wa-bubble-content">${safeContent}</div>
                <div class="wa-bubble-meta">
                  <span class="wa-bubble-time">${time}</span>
                  ${isAdvisor || !isUser ? `<span class="wa-check">✓✓</span>` : ''}
                </div>
              </div>
            `;
          }).join('');

          // Auto-scroll al fondo
          inboxMessagesFeed.scrollTop = inboxMessagesFeed.scrollHeight;
        }
      }

      // Actualizar Ficha Customer 360 (Columna 3)
      if (inboxCustAvatar) inboxCustAvatar.textContent = initials;
      if (inboxCustName) inboxCustName.textContent = lead.name || 'Interesado UdeA';
      if (inboxCustPhone) inboxCustPhone.textContent = lead.phone_number || '';
      
      const cleanPhone = (lead.phone_number || '').replace(/[^\d]/g, '');
      if (inboxCustWaLink) inboxCustWaLink.href = `https://wa.me/${cleanPhone}`;

      if (inboxCustDoc) {
        inboxCustDoc.textContent = (lead.doc_number) ? `${lead.doc_type || 'CC'} ${lead.doc_number}` : 'No suministrado';
      }
      if (inboxCustEmail) inboxCustEmail.textContent = lead.email || 'No registrado';
      if (inboxCustProfession) inboxCustProfession.textContent = lead.segment_profession || 'Por Definir';
      if (inboxCustArea) inboxCustArea.textContent = lead.thematic_area || 'Clínica General';
      if (inboxCustProgram) inboxCustProgram.textContent = lead.program_interest || 'Oferta Institucional General';

      // Enlaces oficiales: Pago directo (formulario de inscripción) e Info general del programa
      const foundCourse = allPortfolioItems.find(p => p.title.toLowerCase().includes((lead.program_interest || '').toLowerCase()));

      if (inboxCustPaymentDirectLink) {
        if (foundCourse && (foundCourse.payment_link || foundCourse.registration_url)) {
          inboxCustPaymentDirectLink.href = foundCourse.payment_link || foundCourse.registration_url;
          inboxCustPaymentDirectLink.style.display = 'inline-flex';
        } else {
          inboxCustPaymentDirectLink.href = 'https://extension.medicinaudea.co/oferta-academica/';
          inboxCustPaymentDirectLink.style.display = 'inline-flex';
        }
      }

      if (inboxCustInfoLink) {
        if (foundCourse && (foundCourse.registration_link || foundCourse.specific_url)) {
          inboxCustInfoLink.href = foundCourse.registration_link || foundCourse.specific_url;
          inboxCustInfoLink.style.display = 'inline-flex';
        } else if (foundCourse && foundCourse.registration_url) {
          inboxCustInfoLink.href = foundCourse.registration_url;
          inboxCustInfoLink.style.display = 'inline-flex';
        } else {
          inboxCustInfoLink.href = 'https://extension.medicinaudea.co/oferta-academica/';
          inboxCustInfoLink.style.display = 'inline-flex';
        }
      }

      // Select de Asesores
      if (inboxCustAdvisorSelect) {
        const currentAdv = lead.assigned_advisor || 'Sin Asignar';
        inboxCustAdvisorSelect.innerHTML = [
          `<option value="Sin Asignar" ${currentAdv === 'Sin Asignar' ? 'selected' : ''}>Sin Asignar</option>`,
          ...allAdvisorsList.map(a => `<option value="${escapeHtml(a.name)}" ${currentAdv === a.name ? 'selected' : ''}>${escapeHtml(a.name)}</option>`)
        ].join('');
      }

      // Select de Estado
      if (inboxCustStatusSelect) {
        inboxCustStatusSelect.value = lead.status || 'ai_handling';
      }

      // Select de Temperatura
      if (inboxCustTempSelect) {
        inboxCustTempSelect.value = lead.interest_temperature || 'cold';
      }

      // Textarea de Notas Internas
      if (inboxCustNotesTextarea) {
        inboxCustNotesTextarea.value = lead.notes || '';
      }
      if (inboxNotesSavedStatus) inboxNotesSavedStatus.textContent = '';

    } catch (err) {
      console.error('Error al cargar chat en inbox:', err);
    }
  };

  // Enviar mensaje del asesor humano por WhatsApp
  async function sendAdvisorMessageFromInbox() {
    if (!currentInboxPhone) return;
    const text = inboxMessageInput ? inboxMessageInput.value.trim() : '';
    if (!text) return;

    const advisorName = getActiveAdvisor();
    btnInboxSendMessage.disabled = true;

    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(currentInboxPhone)}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, advisorName })
      });
      const data = await res.json();

      if (data.success) {
        if (inboxMessageInput) {
          inboxMessageInput.value = '';
          autoResizeComposerTextarea();
        }
        // Recargar chat y actualizar lista
        await window.selectInboxLead(currentInboxPhone);
        fetchLeads();
      } else {
        alert('Error enviando mensaje: ' + (data.error || 'Desconocido'));
      }
    } catch (err) {
      alert('Error de conexión al enviar: ' + err.message);
    } finally {
      if (btnInboxSendMessage) btnInboxSendMessage.disabled = false;
      if (inboxMessageInput) inboxMessageInput.focus();
    }
  }

  if (btnInboxSendMessage) {
    btnInboxSendMessage.addEventListener('click', sendAdvisorMessageFromInbox);
  }

  // Auto-ajustar altura al escribir y enviar con Enter (y shift+enter para salto de línea)
  if (inboxMessageInput) {
    inboxMessageInput.addEventListener('input', autoResizeComposerTextarea);
    inboxMessageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAdvisorMessageFromInbox();
      }
    });
  }

  // Handlers para el Modal Administrativo de Respuestas Rápidas (CRUD)
  const cannedResponseModal = document.getElementById('cannedResponseModal');
  const btnOpenNewMacroModal = document.getElementById('btnOpenNewMacroModal');
  const btnCloseCannedModal = document.getElementById('btnCloseCannedModal');
  const btnCancelCannedModal = document.getElementById('btnCancelCannedModal');
  const cannedResponseForm = document.getElementById('cannedResponseForm');
  const cannedModalTitle = document.getElementById('cannedModalTitle');
  const cannedMacroId = document.getElementById('cannedMacroId');
  const cannedMacroTitle = document.getElementById('cannedMacroTitle');
  const cannedMacroShortcut = document.getElementById('cannedMacroShortcut');
  const cannedMacroMessage = document.getElementById('cannedMacroMessage');
  const cannedMacroCategory = document.getElementById('cannedMacroCategory');

  function openNewCannedModal() {
    if (!cannedResponseModal) return;
    if (cannedModalTitle) cannedModalTitle.textContent = 'Nueva Respuesta Rápida';
    if (cannedMacroId) cannedMacroId.value = '';
    if (cannedResponseForm) cannedResponseForm.reset();
    cannedResponseModal.style.display = 'flex';
    if (cannedMacroTitle) cannedMacroTitle.focus();
  }

  function closeCannedModal() {
    if (cannedResponseModal) cannedResponseModal.style.display = 'none';
  }

  window.editCannedResponse = (id) => {
    const item = allCannedResponses.find(r => r.id === id);
    if (!item || !cannedResponseModal) return;
    if (cannedModalTitle) cannedModalTitle.textContent = 'Editar Respuesta Rápida';
    if (cannedMacroId) cannedMacroId.value = item.id;
    if (cannedMacroTitle) cannedMacroTitle.value = item.title || '';
    if (cannedMacroShortcut) cannedMacroShortcut.value = item.shortcut || '';
    if (cannedMacroMessage) cannedMacroMessage.value = item.message || '';
    if (cannedMacroCategory) cannedMacroCategory.value = item.category || 'general';
    cannedResponseModal.style.display = 'flex';
  };

  window.deleteCannedResponse = async (id) => {
    const item = allCannedResponses.find(r => r.id === id);
    const title = item ? item.title : id;
    if (!confirm(`¿Estás seguro de eliminar la respuesta rápida "${title}"? Se actualizará para todos los asesores en tiempo real.`)) {
      return;
    }
    try {
      const token = localStorage.getItem('udea_auth_token');
      const res = await fetch(`/api/canned-responses/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (data.success) {
        await loadCannedResponses();
        loadSystemAdminMetrics();
      } else {
        alert('Error eliminando respuesta rápida: ' + (data.error || 'Desconocido'));
      }
    } catch (err) {
      alert('Error de conexión: ' + err.message);
    }
  };

  if (btnOpenNewMacroModal) btnOpenNewMacroModal.addEventListener('click', openNewCannedModal);
  if (btnCloseCannedModal) btnCloseCannedModal.addEventListener('click', closeCannedModal);
  if (btnCancelCannedModal) btnCancelCannedModal.addEventListener('click', closeCannedModal);

  if (cannedResponseForm) {
    cannedResponseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = (cannedMacroId.value || '').trim();
      const payload = {
        title: (cannedMacroTitle.value || '').trim(),
        shortcut: (cannedMacroShortcut.value || '').trim(),
        message: (cannedMacroMessage.value || '').trim(),
        category: cannedMacroCategory ? cannedMacroCategory.value : 'general'
      };
      const token = localStorage.getItem('udea_auth_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };

      try {
        let res;
        if (id) {
          res = await fetch(`/api/canned-responses/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(payload)
          });
        } else {
          res = await fetch('/api/canned-responses', {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });
        }
        const data = await res.json();
        if (data.success) {
          closeCannedModal();
          await loadCannedResponses();
          loadSystemAdminMetrics();
        } else {
          alert('Error al guardar respuesta rápida: ' + (data.error || 'Desconocido'));
        }
      } catch (err) {
        alert('Error de conexión: ' + err.message);
      }
    });
  }

  // Toggle de IA Apolo (Pausar / Reanudar bot por conversación)
  if (inboxAiToggleCheck) {
    inboxAiToggleCheck.addEventListener('change', async () => {
      if (!currentInboxPhone) return;
      const willBeActive = inboxAiToggleCheck.checked;
      const pauseAi = !willBeActive;

      try {
        const res = await fetch(`/api/leads/${encodeURIComponent(currentInboxPhone)}/toggle-ai`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pauseAi })
        });
        const data = await res.json();
        if (data.success) {
          if (inboxAiToggleLabel) {
            inboxAiToggleLabel.textContent = willBeActive ? '🤖 IA Activa' : '⏸️ IA Pausada (Asesor)';
            inboxAiToggleLabel.style.color = willBeActive ? 'var(--udea-emerald)' : '#ea580c';
          }
          fetchLeads();
        }
      } catch (err) {
        console.error('Error al alternar IA:', err);
      }
    });
  }

  // Estado visual reactivo del botón de atendido
  function updateInboxAttendedButtonState(lead) {
    if (!btnInboxMarkAttended) return;
    const isAttended = lead && (lead.status === 'attended' || !!lead.attended_by);
    if (isAttended) {
      btnInboxMarkAttended.classList.add('btn-inbox-attended-active');
      btnInboxMarkAttended.innerHTML = `
        <svg class="mini-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span>✓ Atendido</span>
      `;
      const advisorText = lead.attended_by || lead.assigned_advisor || 'Asesor';
      const timeStr = lead.attended_at ? new Date(lead.attended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      btnInboxMarkAttended.title = `Atendido por ${advisorText} ${timeStr ? '(' + timeStr + ')' : ''}`;
    } else {
      btnInboxMarkAttended.classList.remove('btn-inbox-attended-active');
      btnInboxMarkAttended.innerHTML = `
        <svg class="mini-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Atendido</span>
      `;
      btnInboxMarkAttended.title = 'Marcar que atendiste a este usuario';
    }
  }

  // Marcar prospecto como atendido por el asesor activo en tiempo real
  window.markAttendedByActiveAdvisor = async function(phone) {
    if (!phone) return;
    const advisor = getActiveAdvisor() || 'Asesor UdeA';
    
    // Feedback visual optimista inmediato
    if (btnInboxMarkAttended && currentInboxPhone === phone) {
      btnInboxMarkAttended.classList.add('btn-inbox-attended-active');
      btnInboxMarkAttended.innerHTML = `
        <svg class="mini-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span>✓ Atendido</span>
      `;
    }

    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(phone)}/attend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advisor })
      });
      const data = await res.json();
      if (data.success) {
        if (inboxCustStatusSelect && currentInboxPhone === phone) {
          inboxCustStatusSelect.value = 'attended';
        }
        if (inboxActiveStatus && currentInboxPhone === phone) {
          inboxActiveStatus.textContent = `✓ Atendido por ${advisor}`;
        }
        if (currentInboxPhone === phone) {
          updateInboxAttendedButtonState(data.lead || { status: 'attended', attended_by: advisor, attended_at: new Date().toISOString() });
        }
        fetchLeads();
      }
    } catch (err) {
      console.error('Error al marcar atendido:', err);
    }
  };

  // Asignar o reasignar asesor
  window.reassignAdvisor = async function(phone, advisor) {
    if (!phone || !advisor) return;
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(phone)}/advisor`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advisor })
      });
      const data = await res.json();
      if (data.success) {
        fetchLeads();
      }
    } catch (err) {
      console.error('Error reasignando asesor:', err);
    }
  };

  // Asignarme el caso inmediatamente
  window.assignToMe = async function(phone) {
    const advisor = getActiveAdvisor();
    await window.reassignAdvisor(phone, advisor);
  };

  // Botón de atendido en la cabecera del chat
  if (btnInboxMarkAttended) {
    btnInboxMarkAttended.addEventListener('click', async () => {
      if (!currentInboxPhone) return;
      await window.markAttendedByActiveAdvisor(currentInboxPhone);
    });
  }

  // Guardar notas internas en Neon Cloud
  if (btnInboxSaveNotes) {
    btnInboxSaveNotes.addEventListener('click', async () => {
      if (!currentInboxPhone) return;
      const notes = inboxCustNotesTextarea ? inboxCustNotesTextarea.value : '';
      btnInboxSaveNotes.disabled = true;

      try {
        const res = await fetch(`/api/leads/${encodeURIComponent(currentInboxPhone)}/notes`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes })
        });
        const data = await res.json();
        if (data.success) {
          if (inboxNotesSavedStatus) {
            inboxNotesSavedStatus.textContent = '✓ Guardado en Neon Cloud';
            setTimeout(() => {
              if (inboxNotesSavedStatus) inboxNotesSavedStatus.textContent = '';
            }, 3000);
          }
          fetchLeads();
        }
      } catch (err) {
        alert('Error guardando notas: ' + err.message);
      } finally {
        btnInboxSaveNotes.disabled = false;
      }
    });
  }

  // Cambiar asesor asignado en Customer 360
  if (inboxCustAdvisorSelect) {
    inboxCustAdvisorSelect.addEventListener('change', async () => {
      if (!currentInboxPhone) return;
      await window.reassignAdvisor(currentInboxPhone, inboxCustAdvisorSelect.value);
    });
  }

  // Asignarme el caso inmediatamente en Customer 360
  if (btnInboxAssignToMe) {
    btnInboxAssignToMe.addEventListener('click', async () => {
      if (!currentInboxPhone) return;
      await window.assignToMe(currentInboxPhone);
      if (inboxCustAdvisorSelect) inboxCustAdvisorSelect.value = getActiveAdvisor();
    });
  }

  // Cambiar estado del lead en Customer 360
  if (inboxCustStatusSelect) {
    inboxCustStatusSelect.addEventListener('change', async () => {
      if (!currentInboxPhone) return;
      const newStatus = inboxCustStatusSelect.value;
      try {
        await fetch(`/api/leads/${encodeURIComponent(currentInboxPhone)}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
        updateInboxAttendedButtonState({ status: newStatus });
        fetchLeads();
      } catch (err) {
        console.warn('Error actualizando estado:', err.message);
      }
    });
  }

  // Copiar link oficial de inscripción y pago del programa de interés con feedback
  if (btnInboxCopyPaymentLink) {
    btnInboxCopyPaymentLink.addEventListener('click', async () => {
      let link = null;

      // 1. Priorizar el enlace directo oficial del formulario de inscripción y pago del curso
      const lead = currentInboxLead || allLoadedLeads.find(l => l.phone_number === currentInboxPhone);
      if (lead && lead.program_interest) {
        const prog = lead.program_interest.toLowerCase();
        const found = allPortfolioItems.find(p => p.title && p.title.toLowerCase().includes(prog));
        if (found && found.payment_link) {
          link = found.payment_link;
        } else if (found && (found.registration_url || found.registration_link)) {
          link = found.registration_url || found.registration_link;
        }
      }

      // 2. Si no, tomar del botón directo de pago en Customer 360
      if (!link && inboxCustPaymentDirectLink && inboxCustPaymentDirectLink.href && !inboxCustPaymentDirectLink.href.endsWith('#') && inboxCustPaymentDirectLink.href !== window.location.href) {
        link = inboxCustPaymentDirectLink.href;
      }

      // 3. Fallback al enlace informativo del curso
      if (!link && inboxCustInfoLink && inboxCustInfoLink.href && !inboxCustInfoLink.href.endsWith('#') && inboxCustInfoLink.href !== window.location.href) {
        link = inboxCustInfoLink.href;
      }

      if (!link) {
        link = 'https://extension.medicinaudea.co/oferta-academica/';
      }

      // Copiado en portapapeles con fallback seguro
      let copied = false;
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(link);
          copied = true;
        } catch (clipErr) {
          console.warn('Fallo navigator.clipboard, usando fallback textarea:', clipErr);
        }
      }

      if (!copied) {
        try {
          const textArea = document.createElement('textarea');
          textArea.value = link;
          textArea.style.position = 'fixed';
          textArea.style.left = '-9999px';
          textArea.style.top = '-9999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          copied = document.execCommand('copy');
          document.body.removeChild(textArea);
        } catch (errFallback) {
          console.warn('Fallo execCommand:', errFallback);
        }
      }

      // Feedback visual interactivo en el botón
      const originalHtml = btnInboxCopyPaymentLink.innerHTML;
      btnInboxCopyPaymentLink.innerHTML = '✓ ¡Copiado!';
      btnInboxCopyPaymentLink.style.backgroundColor = '#059669';
      btnInboxCopyPaymentLink.style.borderColor = '#059669';
      btnInboxCopyPaymentLink.style.color = '#ffffff';

      setTimeout(() => {
        btnInboxCopyPaymentLink.innerHTML = originalHtml;
        btnInboxCopyPaymentLink.style.backgroundColor = '';
        btnInboxCopyPaymentLink.style.borderColor = '';
        btnInboxCopyPaymentLink.style.color = '';
      }, 2500);

      if (!copied) {
        prompt('Copia el enlace oficial de matrícula y pago de la Facultad de Medicina UdeA:', link);
      }
    });
  }

  // Toggle para ocultar / mostrar la Ficha Customer 360 (despejar el chat)
  const btnToggleCustomerPanel = document.getElementById('btnToggleCustomerPanel');
  const btnCloseCustomerPanel = document.getElementById('btnCloseCustomerPanel');
  const agentWorkspaceContainer = document.querySelector('.agent-workspace-container');

  if (btnToggleCustomerPanel) {
    btnToggleCustomerPanel.addEventListener('click', () => {
      if (window.innerWidth <= 1180) {
        if (inboxCustomerPanel) {
          inboxCustomerPanel.classList.toggle('open-drawer');
        }
      } else {
        if (agentWorkspaceContainer) {
          agentWorkspaceContainer.classList.toggle('hide-customer-360');
          const isHidden = agentWorkspaceContainer.classList.contains('hide-customer-360');
          btnToggleCustomerPanel.classList.toggle('active', !isHidden);
        }
      }
    });
  }

  if (btnCloseCustomerPanel) {
    btnCloseCustomerPanel.addEventListener('click', () => {
      if (inboxCustomerPanel) {
        inboxCustomerPanel.classList.remove('open-drawer');
      }
    });
  }

  // Abrir prospecto directamente en la Bandeja del Asesor desde cualquier parte de la app
  window.openLeadInWorkspace = (phone) => {
    window.switchTab('view-inbox');
    window.selectInboxLead(phone);
  };

  // Control de Acceso: Verificar si el asesor está autenticado para mostrar Landing o Dashboard
  function checkAuthAndInit() {
    const token = localStorage.getItem('udea_auth_token');
    const user = JSON.parse(localStorage.getItem('udea_advisor_user') || 'null');

    if (token && user) {
      if (loginLandingView) loginLandingView.style.display = 'none';
      if (dashboardAppView) dashboardAppView.style.display = 'flex';
      updateAdvisorUI(user);
      loadAdvisorsList();
      loadTelemetry();
      fetchLeads();
      fetchPortfolio();
      loadCannedResponses();
      if (typeof loadSimulatorChat === 'function') {
        loadSimulatorChat(simPhoneInput ? simPhoneInput.value : null, false);
      }
    } else {
      if (dashboardAppView) dashboardAppView.style.display = 'none';
      if (loginLandingView) loginLandingView.style.display = 'flex';
    }
  }

  checkAuthAndInit();

  // Polling automático cada 7 segundos SOLO si hay sesión activa
  setInterval(() => {
    if (localStorage.getItem('udea_auth_token')) {
      loadTelemetry();
      fetchLeads();
      loadCannedResponses();
    }
  }, 7000);
});

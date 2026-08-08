/**
 * Campus SOS — Main Application Logic
 * Manages WebSocket connection, UI state, and event coordination
 */

const App = (() => {
  // ─── WhatsApp Helpers ──────────────────────────────────────────────────────
  function showWhatsAppQR(qrDataUrl) {
    const img     = document.getElementById('wa-qr-image');
    const overlay = document.getElementById('wa-qr-overlay');
    if (img) img.src = qrDataUrl;
    if (overlay) overlay.classList.remove('hidden');
    updateWhatsAppBadge('qr', 'Scan QR Code');
    addChatMessage('system', '📱 WhatsApp QR Code appeared — scan it with your phone to activate real message delivery.');
  }

  function onWhatsAppReady(msg) {
    const overlay = document.getElementById('wa-qr-overlay');
    if (overlay) overlay.classList.add('hidden');
    updateWhatsAppBadge('ready', `Connected as ${msg.name}`);
    addChatMessage('system', `✅ WhatsApp connected as ${msg.name}! Real messages will now be delivered to +916385710907 (Medical) and +917639277606 (Security).`);
    const waStatus = document.getElementById('status-whatsapp');
    if (waStatus) waStatus.textContent = `WhatsApp: ✅ ${msg.name}`;

    // Request custom contacts list
    sendWS({ type: 'get_custom_contacts' });
  }

  function renderCustomContacts(contacts) {
    const listEl = document.getElementById('custom-contacts-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const defaultContacts = [
      { name: 'Dr. Anjali Mehta (Medical)', phone: '6385710907', isDefault: true },
      { name: 'Head of Security', phone: '7639277606', isDefault: true }
    ];

    defaultContacts.concat(contacts).forEach(c => {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex; align-items:center; justify-space-between; background:rgba(20,0,0,0.5); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--glass-border); font-size:12px;';
      item.innerHTML = `
        <div>
          <strong style="color:#fff;">${c.name}</strong>
          <span style="font-family:var(--font-mono); color:var(--text-muted); font-size:11px; margin-left:6px;">+91 ${c.phone}</span>
          ${c.isDefault ? '<span style="font-size:9px; background:var(--red-900); color:var(--red-200); padding:1px 6px; border-radius:9px; margin-left:6px;">DEFAULT</span>' : ''}
        </div>
        ${!c.isDefault ? `<button class="quick-btn delete-contact-btn" data-id="${c.id}" data-phone="${c.phone}" style="color:#ff4444; border-color:rgba(200,0,0,0.4); padding:2px 8px; font-size:10px;">🗑️ Delete</button>` : ''}
      `;
      listEl.appendChild(item);
    });

    // Attach delete handlers
    listEl.querySelectorAll('.delete-contact-btn').forEach(btn => {
      btn.onclick = () => {
        sendWS({ type: 'delete_custom_contact', contactId: btn.dataset.id, phone: btn.dataset.phone });
      };
    });
  }

  function updateWhatsAppBadge(status, message) {
    const badge     = document.getElementById('wa-badge');
    const badgeIcon = document.getElementById('wa-badge-icon');
    const badgeText = document.getElementById('wa-badge-text');
    const waStatus  = document.getElementById('status-whatsapp');

    if (!badge) return;
    badge.className = 'wa-badge';

    const states = {
      ready:          { cls: 'wa-ready', icon: '✅', label: 'WA: LIVE' },
      qr:             { cls: 'wa-qr',    icon: '📱', label: 'WA: SCAN QR' },
      authenticated:  { cls: 'wa-ready', icon: '🔐', label: 'WA: AUTH' },
      disconnected:   { cls: 'wa-error', icon: '❌', label: 'WA: OFF' },
      auth_failure:   { cls: 'wa-error', icon: '❌', label: 'WA: FAILED' },
      loading:        { cls: '',         icon: '⏳', label: 'WA: LOADING' },
      error:          { cls: 'wa-error', icon: '⚠️', label: 'WA: ERROR' }
    };

    const s = states[status] || { cls: '', icon: '📱', label: 'WA: ...' };
    if (s.cls) badge.classList.add(s.cls);
    if (badgeIcon) badgeIcon.textContent = s.icon;
    if (badgeText) badgeText.textContent = s.label;
    if (waStatus)  waStatus.textContent  = `WhatsApp: ${message || s.label}`;

    // Click QR badge to re-open QR modal
    if (status === 'qr') {
      badge.onclick = () => document.getElementById('wa-qr-overlay')?.classList.remove('hidden');
    } else {
      badge.onclick = null;
    }
  }

  // ─── Status Bar ────────────────────────────────────────────────────────────
  // ─── State ─────────────────────────────────────────────────────────────────
  let ws = null;
  let connected = false;
  let incidentCount = 0;
  let activeIncidentId = null;
  let timelineEntries = [];
  let campusData = null;
  let isProcessing = false;
  let pendingApprovals = {};

  const WS_URL = `  // ─── WS / REST API Config ──────────────────────────────────────────────────
  const isHttps = window.location.protocol === 'https:';
  const wsProtocol = isHttps ? 'wss:' : 'ws:';

  // Get backend URL from query param ?backend=https://... or fallback to relative
  const urlParams = new URLSearchParams(window.location.search);
  const customBackend = urlParams.get('backend');

  let WS_URL = customBackend
    ? customBackend.replace('http:', 'ws:').replace('https:', 'wss:')
    : `${wsProtocol}//${window.location.host}`;

  let API_BASE = customBackend ? customBackend.replace(/\/$/, '') : '';
  const CAMPUS_API = `${API_BASE}/api/campus-map`;

  let useRestFallback = false;
  let wsRetryCount = 0;
  let restPollInterval = null;

  // ─── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    // Load campus map data first
    try {
      const res = await fetch(CAMPUS_API);
      campusData = await res.json();
      MapRenderer.init('campus-svg', campusData);
    } catch (e) {
      console.warn('Could not load campus map:', e);
    }

    // Initialize agent panel
    AgentPanel.init('agents-list');

    // Setup supervisor modal
    SupervisorModal.setupListeners();

    // Connect WebSocket (with REST fallback)
    connectWebSocket();

    // Setup UI events
    setupUI();

    // Initial chat message
    addChatMessage('system', '🔴 Campus SOS Network Online. How can we help? Describe your emergency below.');
  }

  // ─── WebSocket & REST Fallback ─────────────────────────────────────────────
  function connectWebSocket() {
    updateConnectionStatus('connecting');

    try {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        connected = true;
        useRestFallback = false;
        wsRetryCount = 0;
        updateConnectionStatus('connected');
        console.log('✅ WS Connected');
      };

      ws.onclose = () => {
        connected = false;
        wsRetryCount++;
        if (wsRetryCount > 2) {
          enableRestFallback('WebSocket unsupported on server — switched to HTTP REST Mode');
        } else {
          updateConnectionStatus('disconnected');
          setTimeout(connectWebSocket, 3000);
        }
      };

      ws.onerror = () => {
        connected = false;
        wsRetryCount++;
        if (wsRetryCount > 2) {
          enableRestFallback('WebSocket connection failed — switched to HTTP REST Mode');
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleServerMessage(msg);
        } catch (e) {
          console.error('Failed to parse WS message:', e);
        }
      };
    } catch (e) {
      enableRestFallback('WebSocket unavailable — using HTTP REST Mode');
    }
  }

  function enableRestFallback(reason) {
    useRestFallback = true;
    connected = true; // Mark as operational via REST
    updateConnectionStatus('connected');
    const connText = document.querySelector('#connection-badge span');
    if (connText) connText.textContent = 'REST: ONLINE';
    console.log(`ℹ️ ${reason}`);
  }

  function sendWS(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      return true;
    }

    if (useRestFallback || !connected) {
      // Handle via REST API
      handleRestRequest(data);
      return true;
    }
    return false;
  }

  async function handleRestRequest(data) {
    if (data.type === 'get_custom_contacts') {
      try {
        const res = await fetch(`${API_BASE}/api/contacts`);
        const json = await res.json();
        renderCustomContacts(json.contacts || []);
      } catch (e) {}
    } else if (data.type === 'add_custom_contact') {
      try {
        const res = await fetch(`${API_BASE}/api/contacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const json = await res.json();
        addChatMessage('system', `➕ Added contact ${data.name}`);
        const cRes = await fetch(`${API_BASE}/api/contacts`);
        const cJson = await cRes.json();
        renderCustomContacts(cJson.contacts || []);
      } catch (e) {}
    } else if (data.type === 'delete_custom_contact') {
      try {
        await fetch(`${API_BASE}/api/contacts/${data.contactId}`, { method: 'DELETE' });
        const cRes = await fetch(`${API_BASE}/api/contacts`);
        const cJson = await cRes.json();
        renderCustomContacts(cJson.contacts || []);
      } catch (e) {}
    } else if (data.type === 'supervisor_decision') {
      try {
        await fetch(`${API_BASE}/api/supervisor/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } catch (e) {}
    }
  }

  // ─── Server Message Handler ────────────────────────────────────────────────
  function handleServerMessage(msg) {
    switch (msg.type) {
      case 'system':
        updateStatusBar(msg);
        break;

      case 'incident_start':
        onIncidentStart(msg);
        break;

      case 'agent_update':
        onAgentUpdate(msg);
        break;

      case 'supervisor_action':
        onSupervisorAction(msg);
        break;

      case 'whatsapp_qr':
        showWhatsAppQR(msg.qr);
        break;

      case 'whatsapp_ready':
        onWhatsAppReady(msg);
        break;

      case 'whatsapp_status':
        updateWhatsAppBadge(msg.status, msg.message);
        break;

      case 'custom_contacts_list':
      case 'custom_contacts_updated':
        renderCustomContacts(msg.contacts || []);
        if (msg.message) addChatMessage('system', msg.message);
        break;

      case 'error':
        addChatMessage('system', `❌ ${msg.message}`);
        break;
    }
  }

  function onIncidentStart(msg) {
    isProcessing = true;
    incidentCount++;
    document.getElementById('incident-counter').textContent = `INCIDENTS: ${incidentCount}`;

    setProcessingState(true);
    AgentPanel.resetAll();
    clearTimeline();
    MapRenderer.reset();
    document.getElementById('map-incident-card').classList.remove('visible');

    addTimelineEntry({
      agent: 'COORDINATOR',
      text: `New incident opened | Reporting: "${msg.rawText}"`,
      time: formatTime(msg.timestamp)
    });
  }

  function onAgentUpdate(msg) {
    const { agent, status, message, detail, data, requiresApproval, approvalAction, incident, incidentId } = msg;
    const time = formatTime(msg.timestamp);

    // Update agent card (except coordinator)
    if (agent && agent !== 'coordinator') {
      AgentPanel.update(agent, { status, message: message || '', detail: detail || '' });
    }

    // Add to timeline
    if (message) {
      addTimelineEntry({ agent: agent?.toUpperCase() || 'SYSTEM', text: message, time });
    }

    // Handle specific agent data
    if (agent === 'emergency' && status === 'done' && data) {
      handleEmergencyData(data);
    }

    if (agent === 'location' && status === 'done' && data) {
      handleLocationData(data);
    }

    if (agent === 'transport' && status === 'done' && data) {
      handleTransportData(data);
    }

    // Supervisor approval request
    if (requiresApproval && approvalAction) {
      // Small delay so the user sees the "awaiting" state first
      setTimeout(() => {
        SupervisorModal.show(approvalAction, (decision) => {
          sendWS({
            type: 'supervisor_decision',
            approvalId: decision.approvalId,
            approved: decision.approved
          });
          addChatMessage('system', decision.approved
            ? `✅ Supervisor approved: ${approvalAction.description}`
            : `❌ Supervisor rejected: ${approvalAction.description}`
          );
        });
      }, 800);
    }

    // Coordinator done — show final summary
    if (agent === 'coordinator' && status === 'done' && incident) {
      activeIncidentId = incidentId;
      onCoordinationComplete(incident);
    }

    // Coordinator error
    if (agent === 'coordinator' && status === 'error') {
      isProcessing = false;
      setProcessingState(false);
      addChatMessage('system', `❌ ${message}`);
    }
  }

  function onSupervisorAction(msg) {
    addTimelineEntry({
      agent: 'SUPERVISOR',
      text: msg.message,
      time: formatTime(msg.timestamp)
    });
  }

  // ─── Emergency Data Handlers ───────────────────────────────────────────────
  function handleEmergencyData(data) {
    // Update chat with first-aid instructions
    const card = document.createElement('div');
    card.className = 'instructions-card';

    const title = document.createElement('div');
    title.className = 'instructions-title';
    title.innerHTML = `🩺 Immediate Instructions — ${data.emergencyType.toUpperCase()}`;
    card.appendChild(title);

    const list = document.createElement('ul');
    list.className = 'instructions-list';
    (data.instructions || []).forEach(inst => {
      const li = document.createElement('li');
      li.textContent = inst;
      list.appendChild(li);
    });
    card.appendChild(list);

    const msgEl = document.createElement('div');
    msgEl.className = 'chat-message system';
    msgEl.appendChild(card);
    document.getElementById('chat-messages').appendChild(msgEl);
    scrollChat();

    // Update incident card on map
    document.getElementById('incident-type-text').textContent = `${data.emergencyType.toUpperCase()} EMERGENCY`;
    document.getElementById('severity-badge').textContent = data.severity;
    document.getElementById('severity-badge').className = `severity-badge ${data.severity}`;
  }

  function handleLocationData(data) {
    if (!data.incidentBlock) return;

    // Highlight on map
    MapRenderer.highlightIncident(data.incidentBlock.id);

    // Draw route from medical to incident
    if (data.resources?.nearestMedical) {
      MapRenderer.drawRoute('medical', data.incidentBlock.id, '#00cc66', 'Medical');
    }

    // Draw route from security to incident
    if (data.resources?.nearestSecurity) {
      MapRenderer.drawRoute('security', data.incidentBlock.id, '#ff6600', 'Security');
    }

    // Show incident card on map
    const card = document.getElementById('map-incident-card');
    card.classList.add('visible');

    document.getElementById('incident-location-text').textContent = data.incidentBlock.label;
    document.getElementById('stat-distance').textContent = `${data.resources.nearestMedical.distanceMeters}m`;
    document.getElementById('stat-eta').textContent = `${data.resources.nearestMedical.etaMinutes}min`;
    document.getElementById('stat-gate').textContent = data.incidentBlock.nearestGate || 'Gate 1';
  }

  function handleTransportData(data) {
    if (!data.vehicle) return;

    // Draw vehicle route
    if (campusData) {
      const parking = campusData.vehicleParking;
      // We'll just update the map incident card
    }
    document.getElementById('stat-vehicle').textContent = data.vehicle.name || 'EMS';
  }

  function onCoordinationComplete(incident) {
    isProcessing = false;
    setProcessingState(false);

    const summary = incident.summary || {};

    addChatMessage('alert', [
      `✅ INCIDENT ${incident.id} — COORDINATION COMPLETE`,
      `📍 Location: ${summary.location || 'Unknown'}`,
      `🔒 Security: ${summary.securityDispatched || 0} officer(s) dispatched`,
      `🚑 Vehicle: ${summary.vehicleDispatched || 'EMS'} | ETA: ${summary.vehicleETA || 'Unknown'}`,
      `📞 Notified: ${summary.contactsNotified || 0} contacts`,
      `⏱️ Response time: ${summary.duration || 'Unknown'}`
    ].join('\n'));

    addTimelineEntry({ agent: 'COORDINATOR', text: `✅ Full response coordinated | ID: ${incident.id}`, time: formatTime() });

    // Update incident ID tag
    document.getElementById('incident-id-tag').textContent = incident.id;
  }

  // ─── UI Setup ──────────────────────────────────────────────────────────────
  function setupUI() {
    const textarea = document.getElementById('emergency-input');
    const sendBtn = document.getElementById('send-sos');

    // Send on button click
    sendBtn.addEventListener('click', submitEmergency);

    // Send on Ctrl+Enter
    textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submitEmergency();
    });

    // Block selector dropdown change listener
    const blockSelect = document.getElementById('block-select');
    if (blockSelect) {
      blockSelect.addEventListener('change', () => {
        const val = blockSelect.value;
        if (val && val !== 'auto') {
          MapRenderer.highlightIncident(val);
        } else {
          MapRenderer.reset();
        }
      });
    }

    // Map click handler callback
    window.onBlockClick = (blockId) => {
      if (blockSelect) {
        blockSelect.value = blockId;
      }
      MapRenderer.highlightIncident(blockId);
      const blockName = blockId.replace('block-', 'Block ').toUpperCase();
      addChatMessage('system', `📍 Location manually selected: ${blockName}`);
    };

    // Quick scenario buttons
    document.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        textarea.value = btn.dataset.text;
        textarea.focus();
      });
    });

    // Clear timeline button
    const clearBtn = document.getElementById('clear-timeline');
    if (clearBtn) clearBtn.addEventListener('click', clearTimeline);

    // Contacts modal buttons
    const openContactsBtn = document.getElementById('open-contacts-btn');
    const closeContactsBtn = document.getElementById('close-contacts-btn');
    const addContactBtn = document.getElementById('add-contact-btn');
    const contactsOverlay = document.getElementById('contacts-overlay');

    let localCustomContacts = [];

    if (openContactsBtn) {
      openContactsBtn.onclick = () => {
        renderCustomContacts(localCustomContacts);
        if (contactsOverlay) contactsOverlay.classList.remove('hidden');
        sendWS({ type: 'get_custom_contacts' });
      };
    }
    if (closeContactsBtn) {
      closeContactsBtn.onclick = () => {
        if (contactsOverlay) contactsOverlay.classList.add('hidden');
      };
    }
    if (addContactBtn) {
      addContactBtn.onclick = () => {
        const nameInput = document.getElementById('new-contact-name');
        const phoneInput = document.getElementById('new-contact-phone');
        const name = nameInput?.value.trim();
        const phone = phoneInput?.value.trim();

        if (!phone || phone.length < 10) {
          alert('Please enter a valid phone number (at least 10 digits)');
          return;
        }

        const newC = { id: `c_${Date.now()}`, name: name || 'Emergency Contact', phone };
        localCustomContacts.push(newC);
        renderCustomContacts(localCustomContacts);

        sendWS({
          type: 'add_custom_contact',
          name: name || 'Emergency Contact',
          phone,
          role: 'custom_contact'
        });

        if (nameInput) nameInput.value = '';
        if (phoneInput) phoneInput.value = '';
      };
    }
  }

  function submitEmergency() {
    const textarea = document.getElementById('emergency-input');
    const blockSelect = document.getElementById('block-select');
    let text = textarea.value.trim();

    if (!text || isProcessing) return;

    // If specific block is selected (not auto), append explicit block location
    const selectedBlock = blockSelect ? blockSelect.value : 'auto';
    let fullText = text;
    if (selectedBlock && selectedBlock !== 'auto') {
      const blockLabels = {
        'block-a': 'Block A',
        'block-b': 'Block B',
        'block-c': 'Block C',
        'block-d': 'Block D',
        'medical': 'Medical Center',
        'security': 'Security HQ',
        'admin': 'Admin Block',
        'cafeteria': 'Cafeteria',
        'library': 'Library',
        'lab': 'Science Labs',
        'sports': 'Sports Complex'
      };
      const label = blockLabels[selectedBlock] || selectedBlock;
      // Prepend/Ensure location is explicitly specified
      if (!text.toLowerCase().includes(label.toLowerCase())) {
        fullText = `${text} at ${label}`;
      }
    }

    if (!connected) {
      addChatMessage('system', '⚠️ Not connected to emergency network. Retrying...');
      return;
    }

    // Add user message to chat
    addChatMessage('user', text);
    textarea.value = '';

    if (useRestFallback) {
      // Submit via HTTP REST POST
      isProcessing = true;
      setProcessingState(true);

      fetch(`${API_BASE}/api/emergency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullText })
      })
      .then(res => res.json())
      .then(data => {
        if (data.incidentId) {
          activeIncidentId = data.incidentId;
          onIncidentStart({ rawText: fullText, timestamp: new Date().toISOString() });
          // Poll incident status
          pollIncidentStatus(data.incidentId);
        }
      })
      .catch(err => {
        addChatMessage('system', `❌ Error submitting emergency: ${err.message}`);
        setProcessingState(false);
      });
      return;
    }

    // Send to server via WS
    const sent = sendWS({ type: 'emergency_report', text: fullText });
    if (!sent) {
      addChatMessage('system', '❌ Failed to send — check connection');
    }
  }

  async function pollIncidentStatus(incidentId) {
    if (restPollInterval) clearInterval(restPollInterval);
    let attempts = 0;

    restPollInterval = setInterval(async () => {
      attempts++;
      if (attempts > 30) {
        clearInterval(restPollInterval);
        setProcessingState(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/incidents/${incidentId}`);
        const json = await res.json();
        if (json.incident && json.incident.timeline) {
          // Process latest timeline update
          json.incident.timeline.forEach(entry => {
            if (!timelineEntries.find(t => t.text === entry.text)) {
              handleServerMessage({
                type: 'agent_update',
                agent: entry.agent?.toLowerCase() || 'coordinator',
                status: 'working',
                message: entry.text,
                timestamp: entry.time
              });
            }
          });
          if (json.incident.status === 'completed' || json.incident.status === 'done') {
            clearInterval(restPollInterval);
            setProcessingState(false);
          }
        }
      } catch (e) {}
    }, 1000);
  }

  // ─── Chat Helpers ──────────────────────────────────────────────────────────
  function addChatMessage(role, text) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `chat-message ${role}`;

    if (role === 'alert') {
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble';
      bubble.style.whiteSpace = 'pre-line';
      bubble.textContent = text;
      div.appendChild(bubble);
    } else {
      const sender = document.createElement('div');
      sender.className = 'chat-sender';
      sender.textContent = role === 'user' ? 'YOU' : 'SOS SYSTEM';
      div.appendChild(sender);

      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble';
      bubble.textContent = text;
      div.appendChild(bubble);

      const time = document.createElement('div');
      time.className = 'chat-timestamp';
      time.textContent = formatTime();
      div.appendChild(time);
    }

    container.appendChild(div);
    scrollChat();
  }

  function scrollChat() {
    const container = document.getElementById('chat-messages');
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }

  // ─── Timeline Helpers ──────────────────────────────────────────────────────
  function addTimelineEntry({ agent, text, time }) {
    const container = document.getElementById('timeline-list');

    // Remove empty state
    const empty = container.querySelector('.empty-state');
    if (empty) empty.remove();

    const entry = document.createElement('div');
    entry.className = 'timeline-entry';
    entry.innerHTML = `
      <div class="timeline-dot-col">
        <div class="timeline-dot"></div>
        <div class="timeline-line"></div>
      </div>
      <div class="timeline-content">
        <div class="timeline-agent">${agent}</div>
        <div class="timeline-time">${time}</div>
        <div class="timeline-text">${text}</div>
      </div>
    `;

    container.prepend(entry); // Newest first
    timelineEntries.push({ agent, text, time });
  }

  function clearTimeline() {
    const container = document.getElementById('timeline-list');
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">Timeline will appear here when an emergency is reported</div>
      </div>
    `;
    timelineEntries = [];
  }

  // ─── UI State Helpers ──────────────────────────────────────────────────────
  function setProcessingState(processing) {
    const btn = document.getElementById('send-sos');
    const textarea = document.getElementById('emergency-input');

    if (processing) {
      btn.disabled = true;
      btn.classList.add('processing');
      btn.innerHTML = '⚡ ENGAGING AGENT MATRIX...';
      textarea.disabled = true;
    } else {
      btn.disabled = false;
      btn.classList.remove('processing');
      btn.innerHTML = '⚡ DISPATCH NEURAL AGENTS';
      textarea.disabled = false;
      textarea.focus();
    }
  }

  function updateConnectionStatus(state) {
    const badge = document.getElementById('connection-badge');
    const dot = badge.querySelector('.connection-dot');

    badge.className = `connection-badge ${state === 'connected' ? 'connected' : 'disconnected'}`;
    badge.querySelector('span').textContent = state === 'connected' ? 'LIVE' : state === 'connecting' ? 'CONNECTING' : 'OFFLINE';
  }

  function updateStatusBar(msg) {
    const el = document.getElementById('status-gemini');
    if (el) el.textContent = msg.geminiEnabled ? '✅ Gemini AI' : '⚠️ Rule-based';

    const timeEl = document.getElementById('status-time');
    if (timeEl) {
      setInterval(() => { timeEl.textContent = new Date().toLocaleTimeString(); }, 1000);
    }
  }

  // ─── Utils ─────────────────────────────────────────────────────────────────
  function formatTime(isoString) {
    const date = isoString ? new Date(isoString) : new Date();
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  return { init };
})();

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());

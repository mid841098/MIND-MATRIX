/**
 * Agent Panel Manager
 * Manages the 5 agent status cards with live state updates and animations
 */

const AgentPanel = (() => {
  const AGENTS = {
    emergency: {
      name: 'Emergency Agent',
      icon: '🚨',
      role: 'Situation Analysis'
    },
    location: {
      name: 'Location Agent',
      icon: '📍',
      role: 'Campus Navigation'
    },
    security: {
      name: 'Security Agent',
      icon: '🔒',
      role: 'Security Dispatch'
    },
    transport: {
      name: 'Transport Agent',
      icon: '🚑',
      role: 'Vehicle Coordination'
    },
    communication: {
      name: 'Communication Agent',
      icon: '📞',
      role: 'Stakeholder Alerts'
    }
  };

  const statusLabels = {
    idle: 'STANDBY',
    activating: 'ACTIVATING',
    working: 'WORKING',
    awaiting: 'AWAITING APPROVAL',
    done: 'COMPLETE',
    error: 'ERROR'
  };

  function init(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    Object.entries(AGENTS).forEach(([id, config]) => {
      container.appendChild(createCard(id, config));
    });
  }

  function createCard(agentId, config) {
    const card = document.createElement('div');
    card.className = 'agent-card';
    card.id = `agent-card-${agentId}`;

    card.innerHTML = `
      <div class="agent-header">
        <div class="agent-icon" id="agent-icon-${agentId}">${config.icon}</div>
        <div class="agent-info">
          <div class="agent-name">${config.name}</div>
          <div class="agent-status-text" id="agent-status-text-${agentId}">
            ${statusLabels.idle}
          </div>
        </div>
        <div class="agent-status-dot" id="agent-dot-${agentId}"></div>
      </div>
      <div class="agent-message" id="agent-message-${agentId}" style="display:none"></div>
      <div class="agent-detail" id="agent-detail-${agentId}" style="display:none"></div>
      <div class="agent-progress">
        <div class="agent-progress-bar" id="agent-progress-${agentId}"></div>
      </div>
    `;

    return card;
  }

  function update(agentId, { status, message, detail }) {
    const card = document.getElementById(`agent-card-${agentId}`);
    if (!card) return;

    // Remove all status classes
    card.classList.remove('status-idle', 'status-activating', 'status-working', 'status-awaiting', 'status-done', 'status-error');
    card.classList.add(`status-${status}`);

    // Update status text
    const statusText = document.getElementById(`agent-status-text-${agentId}`);
    if (statusText) statusText.textContent = statusLabels[status] || status.toUpperCase();

    // Update message
    const msgEl = document.getElementById(`agent-message-${agentId}`);
    if (msgEl && message) {
      msgEl.textContent = message;
      msgEl.style.display = 'block';
    }

    // Update detail
    const detailEl = document.getElementById(`agent-detail-${agentId}`);
    if (detailEl && detail) {
      detailEl.textContent = detail;
      detailEl.style.display = 'block';
    }

    // Flash effect on update
    card.style.transition = 'none';
    card.style.opacity = '0.7';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        card.style.transition = 'all 0.3s ease';
        card.style.opacity = '1';
      });
    });
  }

  function resetAll() {
    Object.keys(AGENTS).forEach(agentId => {
      const card = document.getElementById(`agent-card-${agentId}`);
      if (!card) return;

      card.classList.remove('status-activating', 'status-working', 'status-awaiting', 'status-done', 'status-error');

      const statusText = document.getElementById(`agent-status-text-${agentId}`);
      if (statusText) statusText.textContent = statusLabels.idle;

      const msgEl = document.getElementById(`agent-message-${agentId}`);
      if (msgEl) { msgEl.textContent = ''; msgEl.style.display = 'none'; }

      const detailEl = document.getElementById(`agent-detail-${agentId}`);
      if (detailEl) { detailEl.textContent = ''; detailEl.style.display = 'none'; }
    });
  }

  return { init, update, resetAll, AGENTS };
})();

window.AgentPanel = AgentPanel;

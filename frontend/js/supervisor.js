/**
 * Supervisor Approval Modal
 * Handles human-in-the-loop approval requests with countdown timer
 */

const SupervisorModal = (() => {
  let onDecision = null;
  let countdownInterval = null;
  let secondsLeft = 30;
  let currentApprovalId = null;

  const CIRCUMFERENCE = 2 * Math.PI * 22; // radius=22

  function show(approvalAction, decisionCallback) {
    onDecision = decisionCallback;
    currentApprovalId = approvalAction.id;
    secondsLeft = 30;

    // Populate modal content
    document.getElementById('modal-action-type').textContent = formatActionType(approvalAction.type);
    document.getElementById('modal-action-desc').textContent = approvalAction.description;
    document.getElementById('modal-action-detail').textContent = approvalAction.details || '';

    // Risk badge
    const riskBadge = document.getElementById('modal-risk-badge');
    riskBadge.textContent = `⚠️ Risk Level: ${approvalAction.riskLevel || 'MEDIUM'}`;
    riskBadge.className = `modal-risk-badge ${approvalAction.riskLevel || 'MEDIUM'}`;

    // Show modal
    const overlay = document.getElementById('supervisor-overlay');
    overlay.classList.remove('hidden');

    // Start countdown
    startCountdown();
  }

  function hide() {
    const overlay = document.getElementById('supervisor-overlay');
    overlay.classList.add('hidden');
    stopCountdown();
  }

  function startCountdown() {
    stopCountdown(); // Clear any existing
    updateCountdownDisplay(secondsLeft);

    countdownInterval = setInterval(() => {
      secondsLeft--;
      updateCountdownDisplay(secondsLeft);

      if (secondsLeft <= 0) {
        stopCountdown();
        // Auto-approve for critical emergencies on timeout
        decide(true, true);
      }
    }, 1000);
  }

  function stopCountdown() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  function updateCountdownDisplay(seconds) {
    const numEl = document.getElementById('countdown-number');
    const progressEl = document.getElementById('countdown-progress');

    if (numEl) numEl.textContent = seconds;

    if (progressEl) {
      const totalTime = 30;
      const progress = seconds / totalTime;
      const offset = CIRCUMFERENCE * (1 - progress);
      progressEl.style.strokeDasharray = `${CIRCUMFERENCE}`;
      progressEl.style.strokeDashoffset = offset;

      // Color shift: green → yellow → red
      if (seconds > 20) progressEl.style.stroke = '#00cc66';
      else if (seconds > 10) progressEl.style.stroke = '#ffaa00';
      else progressEl.style.stroke = '#cc0000';
    }

    const labelEl = document.getElementById('countdown-label');
    if (labelEl) {
      if (seconds <= 5) {
        labelEl.innerHTML = `<strong>⚡ Auto-approving in ${seconds}s</strong>Critical emergencies auto-escalate`;
      } else {
        labelEl.innerHTML = `<strong>Human approval required</strong>Auto-approves in ${seconds}s if no response`;
      }
    }
  }

  function decide(approved, autoApproved = false) {
    hide();
    if (onDecision) {
      onDecision({
        approvalId: currentApprovalId,
        approved,
        autoApproved
      });
    }
  }

  function formatActionType(type) {
    const labels = {
      external_ambulance: '🚑 EXTERNAL AMBULANCE CALL',
      contact_guardian: '👨‍👩‍👧 GUARDIAN NOTIFICATION',
      police_escalation: '🚔 POLICE ESCALATION',
      evacuation: '🚨 EVACUATION ORDER'
    };
    return labels[type] || type.toUpperCase().replace(/_/g, ' ');
  }

  function setupListeners() {
    document.getElementById('btn-approve').addEventListener('click', () => decide(true));
    document.getElementById('btn-reject').addEventListener('click', () => decide(false));
  }

  return { show, hide, decide, setupListeners };
})();

window.SupervisorModal = SupervisorModal;

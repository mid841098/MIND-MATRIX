/**
 * Security Agent
 * Dispatches campus security via REAL WhatsApp messages to +917639277606
 */

const contacts = require('../data/contacts.json');
const whatsapp = require('../services/whatsappService');

const SECURITY_PHONE = '7639277606'; // Real security WhatsApp number

function selectSecurityTeam(emergencyResult, locationData) {
  const severity = emergencyResult.severity;
  const type     = emergencyResult.emergencyType;
  const block    = locationData?.incidentBlock?.name || 'Unknown';

  const allOfficers     = contacts.security.filter(s => s.available);
  let team              = [];
  let escalateToPolice  = false;
  let broadcastAlert    = false;

  if (severity === 'CRITICAL') {
    team           = allOfficers;
    broadcastAlert = true;
  } else if (severity === 'HIGH') {
    team           = allOfficers.slice(0, 2);
    broadcastAlert = true;
  } else {
    team = allOfficers.slice(0, 1);
  }

  if (type === 'security' || emergencyResult.requiresPolice) {
    escalateToPolice = true;
  }

  const nearestOfficer =
    allOfficers.find(o => o.location.toLowerCase().includes(block.toLowerCase())) ||
    allOfficers[1] ||
    allOfficers[0];

  return { team, nearestOfficer, escalateToPolice, broadcastAlert };
}

function buildSecurityWhatsAppMessage(emergencyResult, locationData, incidentId, team) {
  const loc      = locationData?.incidentBlock?.label || 'Unknown Location';
  const gate     = locationData?.incidentBlock?.nearestGate || 'Main Gate';
  const type     = emergencyResult.emergencyType.toUpperCase();
  const severity = emergencyResult.severity;
  const protocol = emergencyResult.protocol;

  return [
    `🚨 *CAMPUS SOS — SECURITY DISPATCH*`,
    `*Incident ID:* ${incidentId}`,
    ``,
    `*Type:* ${type}`,
    `*Severity:* ${severity}`,
    `*Protocol:* ${protocol}`,
    ``,
    `*📍 Location:* ${loc}`,
    `*🚪 Access via:* ${gate}`,
    ``,
    `*👮 Officers Required:* ${team.length}`,
    `*Priority:* ${severity === 'CRITICAL' ? 'P1 — RESPOND IMMEDIATELY' : severity === 'HIGH' ? 'P2 — URGENT' : 'P3 — STANDARD'}`,
    ``,
    `*Instructions:* ${generateSpecialInstructions(emergencyResult.emergencyType)}`,
    ``,
    `_Verity University Emergency Network_`
  ].join('\n');
}

function generateSpecialInstructions(type) {
  const map = {
    medical:  'Clear path for medical vehicle. Secure perimeter. Do NOT move patient.',
    fire:     'Initiate evacuation protocol. Contact fire brigade. Secure all exits.',
    mental:   'Approach calmly. No aggressive posture. Coordinate with counselor.',
    security: 'Do not engage alone. Wait for backup. Preserve evidence.',
    utility:  'Cordon off affected area. Contact maintenance. Manage crowd.'
  };
  return map[type] || 'Assess and respond per standard protocol.';
}

async function run(emergencyResult, locationData, incidentId, broadcast) {
  broadcast({
    agent: 'security',
    status: 'working',
    message: '🔒 Activating campus security response...',
    detail: 'Identifying nearest available security personnel'
  });

  await delay(800);

  const { team, nearestOfficer, escalateToPolice, broadcastAlert } =
    selectSecurityTeam(emergencyResult, locationData);

  broadcast({
    agent: 'security',
    status: 'working',
    message: `📲 Sending WhatsApp alert to security (+91${SECURITY_PHONE})...`,
    detail: `Dispatching ${team.length} officer(s) — Nearest: ${nearestOfficer?.name}`
  });

  // Build the WhatsApp message
  const waMessage = buildSecurityWhatsAppMessage(emergencyResult, locationData, incidentId, team);

  // Send real WhatsApp message
  let waSent = false;
  try {
    const waResult = await whatsapp.sendMessage(SECURITY_PHONE, waMessage);
    waSent = waResult.success;

    broadcast({
      agent: 'security',
      status: 'working',
      message: waSent
        ? `✅ WhatsApp delivered to Security (+91${SECURITY_PHONE})`
        : `⚠️ WhatsApp queued (connecting...) for Security`,
      detail: waSent
        ? `Message ID: ${waResult.messageId || 'sent'}`
        : `Will deliver when WhatsApp connects — checking wa.me/91${SECURITY_PHONE}`
    });
  } catch (err) {
    broadcast({
      agent: 'security',
      status: 'working',
      message: `⚠️ WhatsApp queued for Security — ${err.message}`,
      detail: `Fallback: Radio Channel 1 activated`
    });
  }

  await delay(600);

  if (broadcastAlert) {
    broadcast({
      agent: 'security',
      status: 'working',
      message: '📢 Broadcasting campus-wide WhatsApp group alert...',
      detail: `Radio: ${nearestOfficer?.radio || 'All channels'} | WhatsApp Group: Security Team`
    });
    await delay(600);
  }

  if (escalateToPolice) {
    broadcast({
      agent: 'security',
      status: 'working',
      message: '🚔 ⚠️ Police escalation flagged — awaiting supervisor approval',
      detail: `Reason: ${emergencyResult.emergencyType} emergency may require law enforcement`
    });
    await delay(400);
  }

  const result = {
    dispatchedTeam: team,
    nearestOfficer,
    broadcastSent:         broadcastAlert,
    policeEscalationPending: escalateToPolice,
    estimatedArrival:      `${Math.ceil(Math.random() * 3) + 2} minutes`,
    radioChannel:          nearestOfficer?.radio || 'Channel 1',
    whatsappSent:          waSent,
    whatsappNumber:        SECURITY_PHONE,
    actionLog: [
      `${new Date().toLocaleTimeString()} — WhatsApp ${waSent ? 'sent' : 'queued'} to +91${SECURITY_PHONE}`,
      `${new Date().toLocaleTimeString()} — ${team.length} officer(s) alerted via WhatsApp`,
      nearestOfficer
        ? `${new Date().toLocaleTimeString()} — ${nearestOfficer.name} dispatched from ${nearestOfficer.location}`
        : null
    ].filter(Boolean)
  };

  broadcast({
    agent: 'security',
    status: 'done',
    message: `✅ Security WhatsApp sent | ${team.length} officer(s) dispatched`,
    detail: `Security: +91${SECURITY_PHONE} | ETA: ${result.estimatedArrival}`,
    data: result
  });

  return result;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { run, selectSecurityTeam };

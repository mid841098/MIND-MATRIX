/**
 * Communication Agent
 * Contacts the appropriate warden, guardian, and medical personnel via REAL WhatsApp messages.
 * Uses whatsappService to deliver actual messages.
 */

const contacts = require('../data/contacts.json');
const whatsapp = require('../services/whatsappService');
const fs = require('fs');
const path = require('path');

// Real phone numbers
const MEDICAL_PHONE  = '6385710907';  // Campus Medical Center
const SECURITY_PHONE = '7639277606';  // Campus Security

function getCustomContacts() {
  try {
    const customPath = path.join(__dirname, '..', 'data', 'customContacts.json');
    if (fs.existsSync(customPath)) {
      const data = JSON.parse(fs.readFileSync(customPath, 'utf8'));
      return data.contacts || [];
    }
  } catch (e) {}
  return [];
}

function buildNotificationChain(emergencyResult, locationData, studentInfo) {
  const severity = emergencyResult.severity;
  const type     = emergencyResult.emergencyType;
  const block    = locationData?.incidentBlock?.name || '';
  const chain    = [];

  // 1. Campus Doctor — always for medical
  if (type === 'medical' || emergencyResult.requiresDoctor) {
    const doctor = contacts.medical.find(m => m.available);
    if (doctor) {
      chain.push({
        priority: 1,
        recipient: { ...doctor, phone: MEDICAL_PHONE, whatsapp: MEDICAL_PHONE },
        role: 'campus_doctor',
        method: 'whatsapp',
        requiresApproval: false,
        message: buildDoctorMessage(emergencyResult, locationData)
      });
    }
  }

  // 2. Block Warden (via security number for now)
  const blockWarden = contacts.wardens.find(w => w.block.includes(block) || w.block === 'All');
  if (blockWarden) {
    chain.push({
      priority: 2,
      recipient: { ...blockWarden, phone: SECURITY_PHONE, whatsapp: SECURITY_PHONE },
      role: 'warden',
      method: 'whatsapp',
      requiresApproval: false,
      message: buildWardenMessage(emergencyResult, locationData)
    });
  }

  // 3. Chief Warden — for CRITICAL / HIGH
  if (severity === 'CRITICAL' || severity === 'HIGH') {
    const chief = contacts.wardens.find(w => w.title === 'Chief Warden');
    if (chief && chief.id !== blockWarden?.id) {
      chain.push({
        priority: 3,
        recipient: { ...chief, phone: SECURITY_PHONE, whatsapp: SECURITY_PHONE },
        role: 'chief_warden',
        method: 'whatsapp',
        requiresApproval: false,
        message: buildChiefWardenMessage(emergencyResult, locationData)
      });
    }
  }

  // 4. Custom User-Added Contacts (WhatsApp)
  const customContacts = getCustomContacts();
  customContacts.forEach((cc, idx) => {
    chain.push({
      priority: 3.5,
      recipient: { name: cc.name, phone: cc.phone, whatsapp: cc.phone },
      role: cc.role || 'custom_contact',
      method: 'whatsapp',
      requiresApproval: false,
      message: buildWardenMessage(emergencyResult, locationData)
    });
  });

  // 4. Guardian — REQUIRES SUPERVISOR APPROVAL
  if (severity === 'CRITICAL') {
    chain.push({
      priority: 4,
      recipient: {
        name: 'Student Guardian',
        phone: contacts.guardian.example.phone,
        whatsapp: contacts.guardian.example.phone,
        relation: contacts.guardian.example.relation
      },
      role: 'guardian',
      method: 'whatsapp',
      requiresApproval: true,
      approvalReason: "Contacting student's parents/guardians requires supervisor authorization",
      message: buildGuardianMessage(emergencyResult, locationData, studentInfo)
    });
  }

  return chain;
}

// ─── Message Templates ───────────────────────────────────────────────────────

function buildDoctorMessage(emergency, location) {
  const loc = location?.incidentBlock?.label || 'Unknown Location';
  const type = emergency.emergencyType.toUpperCase();
  const sev  = emergency.severity;
  return [
    `🚨 *CAMPUS SOS — MEDICAL EMERGENCY*`,
    ``,
    `*Type:* ${type}`,
    `*Severity:* ${sev}`,
    `*Location:* ${loc}`,
    `*Access via:* ${location?.incidentBlock?.nearestGate || 'Main Gate'}`,
    ``,
    `Please respond IMMEDIATELY. Campus ambulance has been dispatched.`,
    ``,
    `_Verity University Emergency Network_`
  ].join('\n');
}

function buildWardenMessage(emergency, location) {
  const loc  = location?.incidentBlock?.label || 'Unknown';
  const type = emergency.emergencyType.toUpperCase();
  const sev  = emergency.severity;
  return [
    `🔴 *CAMPUS SOS — WARDEN ALERT*`,
    ``,
    `*Incident:* ${type} emergency`,
    `*Severity:* ${sev}`,
    `*Location:* ${loc}`,
    ``,
    `Security and medical teams have been dispatched.`,
    `Please report to location and assist students.`,
    ``,
    `_Verity University Emergency Network_`
  ].join('\n');
}

function buildChiefWardenMessage(emergency, location) {
  const loc  = location?.incidentBlock?.label || 'Unknown';
  const protocol = emergency.protocol;
  return [
    `🚨 *CAMPUS SOS — CRITICAL INCIDENT REPORT*`,
    ``,
    `*Protocol:* ${protocol} ACTIVATED`,
    `*Location:* ${loc}`,
    `*Severity:* ${emergency.severity}`,
    ``,
    `Multi-agency emergency response is underway.`,
    `All protocols are in effect. Please standby for updates.`,
    ``,
    `_Verity University Emergency Network_`
  ].join('\n');
}

function buildGuardianMessage(emergency, location, studentInfo) {
  const loc = location?.incidentBlock?.label || 'Unknown';
  return [
    `📞 *VERITY UNIVERSITY — IMPORTANT NOTICE*`,
    ``,
    `Dear Parent/Guardian,`,
    ``,
    `We are contacting you regarding a medical situation involving your ward at Verity University.`,
    ``,
    `*Location:* ${loc}`,
    `*Status:* Your student is receiving immediate medical attention.`,
    ``,
    `Please remain available for further communication.`,
    `Campus Helpline: ${contacts.emergency.campusHelpline}`,
    ``,
    `_Verity University Emergency Response Team_`
  ].join('\n');
}

// ─── Main Agent Run ──────────────────────────────────────────────────────────

async function run(emergencyResult, locationData, incidentId, studentInfo, broadcast, requiresSupervisorApproval) {
  broadcast({
    agent: 'communication',
    status: 'working',
    message: '📋 Building WhatsApp notification chain...',
    detail: 'Identifying all stakeholders to contact'
  });

  await delay(700);

  const notificationChain = buildNotificationChain(emergencyResult, locationData, studentInfo);
  const contacted = [];
  const pending   = [];

  broadcast({
    agent: 'communication',
    status: 'working',
    message: `📋 ${notificationChain.length} contacts identified`,
    detail: notificationChain.map(n => `${n.recipient.name || n.role} (+91${n.recipient.phone})`).join(' • ')
  });

  await delay(500);

  // Check WhatsApp status
  const waStatus = whatsapp.getStatus();
  if (!waStatus.ready) {
    broadcast({
      agent: 'communication',
      status: 'working',
      message: '⚠️ WhatsApp connecting — messages will be queued',
      detail: 'Scan QR code on screen if first time setup'
    });
    await delay(400);
  }

  for (const notification of notificationChain) {
    if (notification.requiresApproval) {
      // ── Supervisor Gate ──────────────────────────────────────────────────
      broadcast({
        agent: 'communication',
        status: 'awaiting',
        message: `🔐 Guardian WhatsApp requires supervisor approval`,
        detail: notification.approvalReason,
        requiresApproval: true,
        approvalAction: {
          id: `approve-guardian-${incidentId}`,
          type: 'contact_guardian',
          description: `Send WhatsApp to student guardian (+91${notification.recipient.phone})`,
          details: `Message preview: "${notification.message.substring(0, 80)}..."`,
          riskLevel: 'MEDIUM'
        }
      });

      const approved = await requiresSupervisorApproval({
        id: `approve-guardian-${incidentId}`,
        type: 'contact_guardian',
        description: 'Send WhatsApp to student guardian',
        timeout: 30000
      });

      if (approved) {
        broadcast({
          agent: 'communication',
          status: 'working',
          message: `✅ Approved — Sending WhatsApp to guardian...`,
          detail: `wa.me/${notification.recipient.phone}`
        });
        await delay(800);

        const result = await sendWhatsApp(notification, broadcast);
        contacted.push({ ...notification, status: result.success ? 'whatsapp_sent' : 'failed', result, time: new Date().toISOString() });
      } else {
        broadcast({
          agent: 'communication',
          status: 'working',
          message: `⚠️ Guardian notification deferred`,
          detail: 'Supervisor rejected — can be triggered later'
        });
        pending.push({ ...notification, status: 'deferred' });
      }

    } else {
      // ── Send WhatsApp ────────────────────────────────────────────────────
      broadcast({
        agent: 'communication',
        status: 'working',
        message: `📱 Sending WhatsApp to ${notification.recipient.name || notification.role}...`,
        detail: `+91${notification.recipient.phone} | wa.me/91${notification.recipient.phone}`
      });

      await delay(600);

      const result = await sendWhatsApp(notification, broadcast);

      broadcast({
        agent: 'communication',
        status: 'working',
        message: result.success
          ? `✅ WhatsApp delivered to ${notification.recipient.name || notification.role}`
          : `⚠️ WhatsApp queued (connecting...) for ${notification.recipient.name || notification.role}`,
        detail: result.success
          ? `Message ID: ${result.messageId || 'sent'}`
          : `Will deliver when WhatsApp connects`
      });

      await delay(400);
      contacted.push({
        ...notification,
        status: result.success ? 'whatsapp_sent' : 'queued',
        result,
        time: new Date().toISOString()
      });
    }
  }

  const result = {
    notificationChain,
    contacted,
    pending,
    totalNotified: contacted.length,
    whatsappStatus: whatsapp.getStatus(),
    actionLog: contacted.map(n =>
      `${new Date().toLocaleTimeString()} — WhatsApp ${n.status} → ${n.recipient.name || n.role} (+91${n.recipient.phone})`
    )
  };

  broadcast({
    agent: 'communication',
    status: 'done',
    message: `✅ ${contacted.length} WhatsApp message(s) sent | ${pending.length} pending`,
    detail: contacted.map(c => `+91${c.recipient.phone}`).join(' • '),
    data: result
  });

  return result;
}

/**
 * Actually send a WhatsApp message via the service
 */
async function sendWhatsApp(notification, broadcast) {
  try {
    const result = await whatsapp.sendMessage(
      notification.recipient.phone,
      notification.message
    );
    return result;
  } catch (err) {
    console.error('WhatsApp send error:', err.message);
    return { success: false, error: err.message };
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { run, buildNotificationChain };

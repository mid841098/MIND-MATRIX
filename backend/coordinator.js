/**
 * AI Coordinator
 * The central orchestrator that manages all agents, handles supervisor approvals,
 * and coordinates the full emergency response pipeline.
 */

const { v4: uuidv4 } = require('uuid');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const emergencyAgent = require('./agents/emergencyAgent');
const locationAgent = require('./agents/locationAgent');
const securityAgent = require('./agents/securityAgent');
const transportAgent = require('./agents/transportAgent');
const communicationAgent = require('./agents/communicationAgent');

// Active incidents store
const incidents = new Map();

// Pending supervisor approvals
const pendingApprovals = new Map();

let genAI = null;
function initGemini(apiKey) {
  if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
    console.log('✅ Gemini AI initialized');
  }
}

/**
 * Parse emergency input using Gemini AI or fallback to basic parsing
 */
async function parseEmergencyInput(rawText) {
  const base = {
    rawText,
    timestamp: new Date().toISOString(),
    studentId: `STU-${Math.floor(1000 + Math.random() * 9000)}`
  };

  if (!genAI) {
    // Fallback parsing without AI
    return {
      ...base,
      intent: 'emergency_report',
      confidence: 0.8,
      extractedLocation: extractLocationFallback(rawText),
      extractedPerson: extractPersonFallback(rawText),
      aiParsed: false
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `You are an emergency response AI. Parse this emergency message and extract key information as JSON.

Message: "${rawText}"

Return ONLY valid JSON with these fields:
{
  "intent": "emergency_report|query|false_alarm",
  "confidence": 0.0-1.0,
  "extractedLocation": "block/building name or null",
  "extractedPerson": "who is affected or null",
  "extractedCondition": "what happened or null",
  "urgency": "critical|high|medium|low",
  "summary": "one line summary"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return { ...base, ...JSON.parse(jsonMatch[0]), aiParsed: true };
    }
  } catch (err) {
    console.warn('Gemini parsing failed, using fallback:', err.message);
  }

  return {
    ...base,
    intent: 'emergency_report',
    confidence: 0.75,
    extractedLocation: extractLocationFallback(rawText),
    extractedPerson: extractPersonFallback(rawText),
    aiParsed: false
  };
}

function extractLocationFallback(text) {
  const match = text.match(/block\s*[a-zA-Z0-9]+|hostel|library|cafeteria|sports|lab|medical|admin|gate\s*\d+/i);
  return match ? match[0] : null;
}

function extractPersonFallback(text) {
  const match = text.match(/(?:my\s+)?(roommate|friend|classmate|student|colleague|he|she|they|person)/i);
  return match ? match[0] : 'student';
}

/**
 * Create a supervisor approval promise that resolves when approved/rejected or times out
 */
function createApprovalRequest(approvalConfig) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      pendingApprovals.delete(approvalConfig.id);
      console.log(`⏰ Approval timeout: ${approvalConfig.id} — auto-approving for CRITICAL emergencies`);
      resolve(true); // Auto-approve on timeout for critical emergencies
    }, approvalConfig.timeout || 30000);

    pendingApprovals.set(approvalConfig.id, { resolve, timeout, config: approvalConfig });
  });
}

/**
 * Handle supervisor decision (approve/reject)
 */
function handleSupervisorDecision(approvalId, approved) {
  const approval = pendingApprovals.get(approvalId);
  if (!approval) return false;

  clearTimeout(approval.timeout);
  pendingApprovals.delete(approvalId);
  approval.resolve(approved);
  return true;
}

/**
 * Main incident handler — orchestrates all agents
 */
async function handleIncident(rawText, broadcast, wsBroadcastAll) {
  const incidentId = `INC-${Date.now().toString(36).toUpperCase()}`;

  // Initialize incident record
  const incident = {
    id: incidentId,
    rawText,
    startTime: new Date().toISOString(),
    status: 'processing',
    timeline: [],
    agentResults: {}
  };
  incidents.set(incidentId, incident);

  const addToTimeline = (event) => {
    const entry = { time: new Date().toISOString(), ...event };
    incident.timeline.push(entry);
    return entry;
  };

  // Broadcast coordinator started
  broadcast({
    agent: 'coordinator',
    status: 'working',
    message: `🚨 Incident ${incidentId} opened`,
    detail: 'AI Coordinator initializing multi-agent response...',
    incidentId
  });

  addToTimeline({ event: 'incident_opened', description: `Emergency reported: "${rawText}"` });

  try {
    // ─── PHASE 1: Parse Input ──────────────────────────────────────────────────
    broadcast({ agent: 'coordinator', status: 'working', message: '🧠 Parsing emergency report with AI...', detail: genAI ? 'Using Gemini AI' : 'Using rule-based parser' });
    const parsedInput = await parseEmergencyInput(rawText);
    incident.parsedInput = parsedInput;
    addToTimeline({ event: 'input_parsed', description: `Location: ${parsedInput.extractedLocation || 'unclear'} | Person: ${parsedInput.extractedPerson}` });

    // ─── PHASE 2: Emergency Agent ──────────────────────────────────────────────
    broadcast({ agent: 'emergency', status: 'activating', message: '🚨 Emergency Agent activating...', detail: '' });
    await delay(400);
    const emergencyResult = await emergencyAgent.run(parsedInput, broadcast);
    incident.agentResults.emergency = emergencyResult;
    addToTimeline({ event: 'emergency_classified', description: `${emergencyResult.emergencyType.toUpperCase()} | Severity: ${emergencyResult.severity}` });

    // ─── PHASE 3: Location Agent ───────────────────────────────────────────────
    broadcast({ agent: 'location', status: 'activating', message: '📍 Location Agent activating...', detail: '' });
    await delay(300);
    const locationResult = await locationAgent.run(parsedInput, emergencyResult, broadcast);
    incident.agentResults.location = locationResult;
    addToTimeline({ event: 'location_resolved', description: `Location: ${locationResult.incidentBlock?.label || 'Unknown'}` });

    // ─── PHASE 4: Security + Transport (Parallel) ─────────────────────────────
    broadcast({ agent: 'security', status: 'activating', message: '🔒 Security Agent activating...', detail: '' });
    broadcast({ agent: 'transport', status: 'activating', message: '🚑 Transport Agent activating...', detail: '' });
    await delay(300);

    const requiresApproval = (config) => createApprovalRequest(config);

    const [securityResult, transportResult] = await Promise.all([
      securityAgent.run(emergencyResult, locationResult, incidentId, broadcast),
      transportAgent.run(emergencyResult, locationResult, incidentId, broadcast, requiresApproval)
    ]);

    incident.agentResults.security = securityResult;
    incident.agentResults.transport = transportResult;
    addToTimeline({ event: 'response_dispatched', description: `Security: ${securityResult.dispatchedTeam.length} officers | Vehicle: ${transportResult.vehicle?.name || 'External'}` });

    // ─── PHASE 5: Communication Agent ─────────────────────────────────────────
    broadcast({ agent: 'communication', status: 'activating', message: '📞 Communication Agent activating...', detail: '' });
    await delay(300);
    const commResult = await communicationAgent.run(
      emergencyResult, locationResult, incidentId,
      { id: parsedInput.studentId },
      broadcast,
      requiresApproval
    );
    incident.agentResults.communication = commResult;
    addToTimeline({ event: 'notifications_sent', description: `${commResult.totalNotified} contacts notified` });

    // ─── PHASE 6: Finalize ────────────────────────────────────────────────────
    incident.status = 'active';
    incident.endTime = new Date().toISOString();
    addToTimeline({ event: 'coordination_complete', description: 'All agents have completed their tasks. Monitoring active.' });

    broadcast({
      agent: 'coordinator',
      status: 'done',
      message: `✅ Full emergency response coordinated for ${incidentId}`,
      detail: `${securityResult.dispatchedTeam.length} security | ${transportResult.vehicle?.name || 'External EMS'} dispatched | ${commResult.totalNotified} notified`,
      incidentId,
      incident: {
        id: incidentId,
        timeline: incident.timeline,
        summary: buildIncidentSummary(incident)
      }
    });

    return incident;

  } catch (err) {
    console.error('Coordinator error:', err);
    incident.status = 'error';
    broadcast({
      agent: 'coordinator',
      status: 'error',
      message: `❌ Coordinator error: ${err.message}`,
      detail: 'Partial response may still be active. Contact campus helpline directly.',
      incidentId
    });
    return incident;
  }
}

function buildIncidentSummary(incident) {
  const er = incident.agentResults.emergency;
  const lr = incident.agentResults.location;
  const sr = incident.agentResults.security;
  const tr = incident.agentResults.transport;
  const cr = incident.agentResults.communication;

  return {
    incidentId: incident.id,
    type: er?.emergencyType || 'unknown',
    severity: er?.severity || 'unknown',
    location: lr?.incidentBlock?.label || 'Unknown',
    securityDispatched: sr?.dispatchedTeam?.length || 0,
    vehicleDispatched: tr?.vehicle?.name || 'External EMS',
    vehicleETA: tr?.estimatedArrival || 'Unknown',
    contactsNotified: cr?.totalNotified || 0,
    responseStarted: incident.startTime,
    duration: Math.round((new Date() - new Date(incident.startTime)) / 1000) + 's'
  };
}

function getIncident(id) { return incidents.get(id); }
function getAllIncidents() { return Array.from(incidents.values()); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

module.exports = {
  handleIncident,
  handleSupervisorDecision,
  getIncident,
  getAllIncidents,
  initGemini,
  pendingApprovals
};

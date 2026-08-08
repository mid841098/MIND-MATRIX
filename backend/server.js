/**
 * Campus SOS — Express + WebSocket Server (with real WhatsApp)
 */

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const http       = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const path       = require('path');
const coordinator = require('./coordinator');
const whatsapp   = require('./services/whatsappService');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve root static files (index.html, css/, js/, assets/)
const frontendPath = path.join(__dirname, '..');
app.use(express.static(frontendPath));

// ─── WebSocket Clients ─────────────────────────────────────────────────────────
const clients = new Set();

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function broadcastAll(data) {
  const payload = JSON.stringify(data);
  clients.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(payload); });
}

// ─── Initialize Gemini ────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
coordinator.initGemini(GEMINI_API_KEY);

// ─── Initialize WhatsApp (pass broadcastAll so QR/ready events go to browser) ─
whatsapp.init(broadcastAll);

// ─── WebSocket Connection Handler ──────────────────────────────────────────────
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`✅ Browser connected. Total: ${clients.size}`);

  // Send welcome + current WhatsApp status
  send(ws, {
    type: 'system',
    message: 'Connected to Campus SOS Emergency Network',
    status: 'ready',
    serverTime: new Date().toISOString(),
    geminiEnabled: !!GEMINI_API_KEY,
    whatsapp: whatsapp.getStatus()
  });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      await handleWebSocketMessage(ws, msg);
    } catch (err) {
      send(ws, { type: 'error', message: 'Invalid message format' });
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`❌ Browser disconnected. Total: ${clients.size}`);
  });

  ws.on('error', (err) => {
    console.error('WS error:', err.message);
    clients.delete(ws);
  });
});

async function handleWebSocketMessage(ws, msg) {
  switch (msg.type) {
    case 'emergency_report': {
      const { text } = msg;
      if (!text || text.trim().length < 3) {
        send(ws, { type: 'error', message: 'Please describe the emergency in more detail.' });
        return;
      }
      const broadcast = (agentUpdate) => {
        broadcastAll({ type: 'agent_update', ...agentUpdate, timestamp: new Date().toISOString() });
      };
      broadcastAll({ type: 'incident_start', rawText: text, timestamp: new Date().toISOString() });
      coordinator.handleIncident(text, broadcast, broadcastAll);
      break;
    }

    case 'supervisor_decision': {
      const { approvalId, approved } = msg;
      const handled = coordinator.handleSupervisorDecision(approvalId, approved);
      if (handled) {
        broadcastAll({
          type: 'supervisor_action',
          approvalId,
          approved,
          timestamp: new Date().toISOString(),
          message: approved
            ? `✅ Supervisor approved: ${approvalId}`
            : `❌ Supervisor rejected: ${approvalId}`
        });
      } else {
        send(ws, { type: 'error', message: `No pending approval found: ${approvalId}` });
      }
      break;
    }

    case 'get_whatsapp_status': {
      send(ws, { type: 'whatsapp_status_response', ...whatsapp.getStatus() });
      break;
    }

    case 'get_custom_contacts': {
      const fs = require('fs');
      const customPath = path.join(__dirname, 'data', 'customContacts.json');
      let custom = { contacts: [] };
      if (fs.existsSync(customPath)) {
        try { custom = JSON.parse(fs.readFileSync(customPath, 'utf8')); } catch (e) {}
      }
      send(ws, { type: 'custom_contacts_list', contacts: custom.contacts || [] });
      break;
    }

    case 'add_custom_contact': {
      const fs = require('fs');
      const customPath = path.join(__dirname, 'data', 'customContacts.json');
      let custom = { contacts: [] };
      if (fs.existsSync(customPath)) {
        try { custom = JSON.parse(fs.readFileSync(customPath, 'utf8')); } catch (e) {}
      }
      const newContact = {
        id: `c_${Date.now()}`,
        name: msg.name || 'Emergency Contact',
        phone: msg.phone,
        role: msg.role || 'emergency_recipient',
        addedAt: new Date().toISOString()
      };
      custom.contacts = custom.contacts || [];
      custom.contacts.push(newContact);
      fs.writeFileSync(customPath, JSON.stringify(custom, null, 2));

      broadcastAll({
        type: 'custom_contacts_updated',
        contacts: custom.contacts,
        message: `➕ Added custom contact: ${newContact.name} (${newContact.phone})`
      });
      break;
    }

    case 'delete_custom_contact': {
      const fs = require('fs');
      const customPath = path.join(__dirname, 'data', 'customContacts.json');
      let custom = { contacts: [] };
      if (fs.existsSync(customPath)) {
        try { custom = JSON.parse(fs.readFileSync(customPath, 'utf8')); } catch (e) {}
      }
      custom.contacts = (custom.contacts || []).filter(c => c.id !== msg.contactId && c.phone !== msg.phone);
      fs.writeFileSync(customPath, JSON.stringify(custom, null, 2));

      broadcastAll({
        type: 'custom_contacts_updated',
        contacts: custom.contacts,
        message: `🗑️ Removed custom contact`
      });
      break;
    }

    case 'get_incidents': {
      send(ws, { type: 'incidents_list', incidents: coordinator.getAllIncidents() });
      break;
    }

    case 'ping': {
      send(ws, { type: 'pong', timestamp: new Date().toISOString() });
      break;
    }

    default:
      send(ws, { type: 'error', message: `Unknown message type: ${msg.type}` });
  }
}

// ─── REST API ──────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Campus SOS',
    uptime: process.uptime(),
    clients: clients.size,
    geminiEnabled: !!GEMINI_API_KEY,
    whatsapp: whatsapp.getStatus(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/incidents', (req, res) => {
  res.json({ incidents: coordinator.getAllIncidents() });
});

app.get('/api/incidents/:id', (req, res) => {
  const incident = coordinator.getIncident(req.params.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  res.json({ incident });
});

app.post('/api/emergency', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });
  const broadcast = (u) => broadcastAll({ type: 'agent_update', ...u, timestamp: new Date().toISOString() });
  const incident = await coordinator.handleIncident(text, broadcast, broadcastAll);
  res.json({ incidentId: incident.id, status: 'coordinating' });
});

app.post('/api/supervisor/approve', (req, res) => {
  const { approvalId, approved } = req.body;
  const handled = coordinator.handleSupervisorDecision(approvalId, approved);
  if (!handled) return res.status(404).json({ error: 'Approval not found or already resolved' });
  res.json({ success: true, approvalId, approved });
});

app.get('/api/contacts', (req, res) => {
  const fs = require('fs');
  const customPath = path.join(__dirname, 'data', 'customContacts.json');
  let custom = { contacts: [] };
  if (fs.existsSync(customPath)) {
    try { custom = JSON.parse(fs.readFileSync(customPath, 'utf8')); } catch (e) {}
  }
  res.json(custom);
});

app.post('/api/contacts', (req, res) => {
  const fs = require('fs');
  const customPath = path.join(__dirname, 'data', 'customContacts.json');
  const { name, phone, role } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  let custom = { contacts: [] };
  if (fs.existsSync(customPath)) {
    try { custom = JSON.parse(fs.readFileSync(customPath, 'utf8')); } catch (e) {}
  }
  const newContact = {
    id: `c_${Date.now()}`,
    name: name || 'Emergency Contact',
    phone,
    role: role || 'emergency_recipient',
    addedAt: new Date().toISOString()
  };
  custom.contacts.push(newContact);
  fs.writeFileSync(customPath, JSON.stringify(custom, null, 2));

  broadcastAll({
    type: 'custom_contacts_updated',
    contacts: custom.contacts,
    message: `➕ Added custom contact: ${newContact.name} (${phone})`
  });
  res.json({ success: true, contact: newContact });
});

app.delete('/api/contacts/:id', (req, res) => {
  const fs = require('fs');
  const customPath = path.join(__dirname, 'data', 'customContacts.json');
  let custom = { contacts: [] };
  if (fs.existsSync(customPath)) {
    try { custom = JSON.parse(fs.readFileSync(customPath, 'utf8')); } catch (e) {}
  }
  custom.contacts = (custom.contacts || []).filter(c => c.id !== req.params.id && c.phone !== req.params.id);
  fs.writeFileSync(customPath, JSON.stringify(custom, null, 2));

  broadcastAll({
    type: 'custom_contacts_updated',
    contacts: custom.contacts,
    message: `🗑️ Removed custom contact`
  });
  res.json({ success: true });
});

app.get('/api/campus-map', (req, res) => {
  res.json(require('./data/campusMap.json'));
});

app.get('/api/whatsapp/status', (req, res) => {
  res.json(whatsapp.getStatus());
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ─── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log('');
  console.log('🚨 ═══════════════════════════════════════════════════');
  console.log('🚨  CAMPUS SOS — Emergency Coordination System');
  console.log(`🚨  Server:    http://localhost:${PORT}`);
  console.log(`🚨  WebSocket: ws://localhost:${PORT}`);
  console.log(`🚨  Gemini AI: ${GEMINI_API_KEY ? '✅ Enabled' : '⚠️  Disabled (set GEMINI_API_KEY)'}`);
  console.log('🚨  WhatsApp:  Initializing — scan QR when shown...');
  console.log('🚨 ═══════════════════════════════════════════════════');
  console.log('');
});

module.exports = { app, server };

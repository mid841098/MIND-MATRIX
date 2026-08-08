/**
 * WhatsApp Service — Fixed
 * Handles session auth, ready-state polling fallback, and real message sending.
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const path = require('path');

let client   = null;
let isReady  = false;
let broadcastFn = null;

// Queue for messages sent before ready
const messageQueue = [];

function toChatId(phone) {
  const digits = phone.toString().replace(/[^\d]/g, '');
  const withCC = digits.startsWith('91') ? digits : `91${digits}`;
  return `${withCC}@c.us`;
}

// ─── Poll for ready state after authentication ─────────────────────────────
async function pollUntilReady(maxWaitMs = 120000, intervalMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const state = await client.getState();
      console.log(`🔄 WhatsApp state: ${state}`);
      if (state === 'CONNECTED') {
        console.log('✅ WhatsApp state confirmed CONNECTED via polling');
        onReady();
        return;
      }
    } catch (e) { /* client not ready yet */ }
    await delay(intervalMs);
  }
  console.warn('⚠️ WhatsApp polling timed out — still not ready');
  broadcast({ type: 'whatsapp_status', status: 'error', message: 'WhatsApp connected but not ready — try restarting server' });
}

function onReady() {
  if (isReady) return; // Prevent double trigger
  isReady = true;

  const info = client.info;
  const name = info?.pushname || 'Unknown';
  const num  = info?.wid?.user || '';
  console.log(`\n✅ WhatsApp READY as: ${name} (${num})\n`);

  broadcast({
    type: 'whatsapp_ready',
    name,
    number: num,
    message: `WhatsApp connected as ${name}`,
    timestamp: new Date().toISOString()
  });

  // Flush queued messages
  flushQueue();
}

async function flushQueue() {
  console.log(`📤 Flushing ${messageQueue.length} queued WhatsApp messages...`);
  while (messageQueue.length > 0) {
    const { phone, message, resolve, reject } = messageQueue.shift();
    try {
      const result = await _sendMessage(phone, message);
      resolve(result);
    } catch (e) {
      reject(e);
    }
  }
}

// ─── Init ──────────────────────────────────────────────────────────────────
function init(broadcast) {
  broadcastFn = broadcast;
  console.log('🟢 Initializing WhatsApp client...');

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '..', 'wa_session') }),
    webVersion: '2.3000.1015901307',
    webVersionCache: { type: 'none' },
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-popup-blocking'
      ]
    }
  });

  // ── QR ──────────────────────────────────────────────────────────────────
  client.on('qr', async (qr) => {
    console.log('\n📱 Scan QR code with your WhatsApp:\n');
    try {
      const qrDataUrl = await QRCode.toDataURL(qr, { width: 256, margin: 2 });
      QRCode.toString(qr, { type: 'terminal', small: true }).then(console.log).catch(() => {});
      broadcast({ type: 'whatsapp_qr', qr: qrDataUrl, timestamp: new Date().toISOString() });
    } catch (e) { console.error('QR error:', e.message); }
  });

  // ── Authenticated — start polling since ready may not fire ──────────────
  client.on('authenticated', () => {
    console.log('🔐 WhatsApp authenticated — polling for CONNECTED state...');
    broadcast({ type: 'whatsapp_status', status: 'authenticated', message: 'Authenticated — loading WhatsApp...' });
    // Start polling as fallback — ready event sometimes doesn't fire
    setTimeout(() => pollUntilReady(120000, 3000), 2000);
  });

  // ── Ready (primary path) ─────────────────────────────────────────────────
  client.on('ready', () => {
    console.log('✅ WhatsApp ready event fired!');
    onReady();
  });

  // ── Loading screen ───────────────────────────────────────────────────────
  client.on('loading_screen', (percent, msg) => {
    broadcast({ type: 'whatsapp_status', status: 'loading', message: `Loading WhatsApp... ${percent}% — ${msg}` });
  });

  // ── Auth failure ─────────────────────────────────────────────────────────
  client.on('auth_failure', (msg) => {
    console.error('❌ WhatsApp auth failed:', msg);
    isReady = false;
    broadcast({ type: 'whatsapp_status', status: 'auth_failure', message: 'Auth failed — restart server and re-scan QR' });
  });

  // ── Disconnected ─────────────────────────────────────────────────────────
  client.on('disconnected', (reason) => {
    console.warn('⚠️ WhatsApp disconnected:', reason);
    isReady = false;
    broadcast({ type: 'whatsapp_status', status: 'disconnected', message: `Disconnected: ${reason}` });
  });

  client.initialize().catch(err => {
    console.error('❌ WhatsApp init error:', err.message);
    broadcast({ type: 'whatsapp_status', status: 'error', message: `Init failed: ${err.message}` });
  });
}

// ─── Internal send ─────────────────────────────────────────────────────────
async function _sendMessage(phone, message) {
  const chatId = toChatId(phone);
  try {
    const msg = await client.sendMessage(chatId, message);
    console.log(`✅ WhatsApp sent → +91${phone}`);
    return { success: true, phone, chatId, messageId: msg?.id?._serialized || 'sent' };
  } catch (err) {
    console.error(`❌ WhatsApp send failed → +91${phone}:`, err.message);
    throw err;
  }
}

// ─── Public send — queues if not ready ─────────────────────────────────────
async function sendMessage(phone, message) {
  if (!client) return { success: false, reason: 'not_initialized' };

  if (isReady) {
    return await _sendMessage(phone, message);
  }

  // Queue — wait up to 3 minutes
  console.log(`⏳ WhatsApp not ready — queuing for +91${phone}`);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const idx = messageQueue.findIndex(m => m.resolve === resolve);
      if (idx !== -1) messageQueue.splice(idx, 1);
      // Resolve with failure (don't reject — agent should handle gracefully)
      resolve({ success: false, reason: 'timeout', phone });
    }, 180000); // 3 minutes

    messageQueue.push({
      phone, message,
      resolve: (r) => { clearTimeout(timer); resolve(r); },
      reject:  (e) => { clearTimeout(timer); reject(e); }
    });
  });
}

async function sendToAll(phones, message) {
  return Promise.allSettled(phones.map(p => sendMessage(p, message)));
}

function getStatus() {
  return { ready: isReady, clientExists: !!client, queueLength: messageQueue.length };
}

function broadcast(data) { if (broadcastFn) broadcastFn(data); }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { init, sendMessage, sendToAll, getStatus, toChatId };

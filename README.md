# 🚨 Campus SOS — AI Emergency Coordination System

> **"Our AI doesn't just detect emergencies. It coordinates the humans and systems that respond to them."**

A full-stack autonomous campus emergency coordination system built with Node.js, WebSockets, and a red/black glassmorphism UI. When a student reports an emergency in natural language, the AI Coordinator instantly activates 5 specialized agents that work in parallel to dispatch security, medical resources, and communicate with all stakeholders.

---

## 🏗️ Architecture

```
Student (Browser)
      ↓ WebSocket
AI Coordinator (Node.js)
      ↓
┌─────────────────────────────────────────────────┐
│  🚨 Emergency Agent  →  Classifies & assesses   │
│  📍 Location Agent   →  Resolves campus location │
│  🔒 Security Agent   →  Dispatches officers      │  (Parallel)
│  🚑 Transport Agent  →  Finds & sends vehicles   │  (Parallel)
│  📞 Communication    →  Notifies all contacts    │
└─────────────────────────────────────────────────┘
      ↓
Human Supervisor (Browser Modal) — Approves sensitive actions
```

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. (Optional) Add Gemini AI
```bash
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
# Get one free at: https://aistudio.google.com/app/apikey
```

### 3. Start the server
```bash
npm start
# or for development with auto-reload:
npm run dev
```

### 4. Open the app
Visit **http://localhost:3001** in your browser.

---

## 💡 How to Use

1. **Open the app** in your browser
2. **Describe the emergency** in the chat box (or click a quick-scenario button)
3. **Watch the agents** activate in real-time on the right panel
4. **See the campus map** highlight the incident location with response routes
5. **Act as Human Supervisor** when high-risk actions (ambulance call, parent notification) need approval — a modal will appear with a 30-second countdown

### Example emergency messages:
- `"My roommate collapsed in Block C, he's unconscious"`
- `"There's a fire in Block A hostel, smoke on 3rd floor"`
- `"My friend fell from stairs near Block B, severe leg injury"`
- `"Fight happening near cafeteria, two students involved"`
- `"Friend having mental breakdown in the library"`

---

## 📁 Project Structure

```
campus-sos/
├── backend/
│   ├── server.js              # Express + WebSocket server
│   ├── coordinator.js         # AI orchestrator
│   ├── agents/
│   │   ├── emergencyAgent.js  # Emergency classification
│   │   ├── locationAgent.js   # Campus location resolution
│   │   ├── securityAgent.js   # Security dispatch
│   │   ├── transportAgent.js  # Vehicle dispatch
│   │   └── communicationAgent.js  # Contact notification
│   ├── data/
│   │   ├── campusMap.json     # Campus layout data
│   │   ├── contacts.json      # Wardens, security, medical
│   │   └── vehicles.json      # Vehicle fleet
│   └── package.json
└── frontend/
    ├── index.html             # Single-page app
    ├── css/style.css          # Red/black glassmorphism
    └── js/
        ├── app.js             # Main app + WebSocket client
        ├── map.js             # SVG campus map renderer
        ├── agentPanel.js      # Agent status cards
        └── supervisor.js      # Human approval modal
```

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Server health check |
| `GET` | `/api/incidents` | List all incidents |
| `GET` | `/api/incidents/:id` | Get specific incident |
| `POST` | `/api/emergency` | Report emergency (REST) |
| `POST` | `/api/supervisor/approve` | Submit supervisor decision |
| `GET` | `/api/campus-map` | Campus map data |
| `WS` | `ws://localhost:3001` | Real-time WebSocket |

### WebSocket Message Types

**Client → Server:**
```json
{ "type": "emergency_report", "text": "My roommate collapsed in Block C" }
{ "type": "supervisor_decision", "approvalId": "...", "approved": true }
```

**Server → Client:**
```json
{ "type": "agent_update", "agent": "emergency", "status": "working", "message": "..." }
{ "type": "incident_start", "rawText": "..." }
```

---

## 🔑 Key Features

- **Multi-agent coordination** — 5 specialized AI agents working in parallel
- **Real-time WebSocket** — live agent status updates streamed to browser
- **SVG Campus Map** — interactive map with incident highlighting and animated routes
- **Human Supervisor Gate** — critical actions require human approval with 30s countdown
- **Gemini AI integration** — optional NLP for smarter emergency parsing
- **Rule-based fallback** — works perfectly without any API keys
- **Incident timeline** — full chronological audit trail
- **Quick scenarios** — pre-built test cases for demonstrations

---

## 🎨 Design

- **Theme**: Red & Black Glassmorphism
- **Typography**: Inter + JetBrains Mono (Google Fonts)
- **Layout**: 3-column responsive grid (Chat | Map | Agents+Timeline)
- **Animations**: Agent pulse, route dash, countdown ring, modal spring

---

## 🔮 Future Enhancements

- [ ] Student authentication with ID lookup
- [ ] Real SMS/email via Twilio / SendGrid
- [ ] Google Maps integration for real campus
- [ ] Mobile app (React Native)
- [ ] Incident history & analytics dashboard
- [ ] Multi-campus support
- [ ] Wearable device panic button integration

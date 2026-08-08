# 🚨 CAMPUS SOS — Autonomous Emergency Coordination System
### *Engineered by TEAM MIND MATRIXX* (`CODE • INNOVATE • ELEVATE`)

> **"Our AI doesn't just detect or alert emergencies. It coordinates the humans and systems that respond to the emergency."**

---

## 📌 Executive Overview

**Campus SOS** is an autonomous multi-agent emergency coordination platform designed to solve panic, confusion, and response delays during campus crises. When a student submits a natural language emergency report (e.g., *"My roommate collapsed in Block C"*), Campus SOS deploys a coordinated swarm of 5 specialized AI agents to analyze threats, map locations, dispatch security officers via WhatsApp, route campus ambulances, and notify medical staff and wardens in under 5 seconds.

---

## 📸 Interface Preview

*(Red Glassmorphism Cyberpunk Tactical Command Console)*

- **Header**: Official **TEAM MIND MATRIXX** logo & tagline (`CODE • INNOVATE • ELEVATE`) + Live Telemetry Badges (`📡 12.97°N 77.59°E`, `NEURAL: CONNECTED`, `✅ WA: LIVE`).
- **Left Panel (Command Console)**: Natural language emergency input, Target Node selector (`🏢 Block C (Hostel Node)`), scenario presets, and glowing `⚡ DISPATCH NEURAL AGENTS` trigger button.
- **Center Panel (Tactical Telemetry Map)**: Interactive SVG campus satellite map with animated dashed response routes, real-time node highlighting, and distance/ETA telemetry cards.
- **Right Panel (Agent Matrix & Timeline)**: Live status cards and chronological audit logs for all 5 specialized agents.

---

## 🤖 Decentralized Multi-Agent Architecture

```text
                 Student Emergency Report / Target Node Selection
                                        │
                                        ▼
                          🧠 Neural AI Coordinator
                        (Gemini AI + Intent Parser)
                                        │
    ┌───────────────────────────────────┼───────────────────────────────────┐
    ▼                                   ▼                                   ▼
🚨 Emergency Agent                   📍 Location Agent                  🔒 Security Agent
• Classifies Incident Type          • Resolves Campus Node             • Selects Officer Team
• Assigns Severity (P1/P2/P3)       • Calculates Distances & Routes    • Generates Dispatch Briefing
• Renders First-Aid Protocol        • Animates Satellite Map            • Sends Real WhatsApp Alert
    │                                   │                                   │
    └───────────────────────────────────┼───────────────────────────────────┘
                                        │
    ┌───────────────────────────────────┴───────────────────────────────────┐
    ▼                                                                       ▼
🚑 Transport Agent                                                      📞 Communication Agent
• Fleet Scan (Ambulance/Van)                                            • Multi-Stakeholder Chain
• Computes Drive & Boarding ETA                                         • Real WhatsApp to Doctor
• Triggers External Ambulance                                           • Alerts Wardens & Custom Contacts
    │                                                                       │
    └───────────────────────────────────┬───────────────────────────────────┘
                                        ▼
                        🔐 Human Supervisor Gate
                (30-Sec SVG Countdown Ring for Approval)
```

---

## 💥 The Problem Statement

Imagine a student at 11:30 PM:
> *"My roommate collapsed in the hostel. We don't know whether to call security, ambulance, warden, or contact parents."*

### Current System Flaws:
1. **Panic & Confusion**: Students must manually figure out who to call during moments of extreme stress.
2. **Alert Fatigue**: Existing apps send generic text alerts with zero coordination between responders.
3. **Siloed Communication**: Security, medical staff, hostel wardens, and drivers operate on disconnected channels.

---

## 💡 Key Differentiators

| Feature | Traditional Campus Apps | Campus SOS (TEAM MIND MATRIXX) |
|---|---|---|
| **Core Goal** | Sends panic sound or SMS | **Coordinates the humans & systems that respond** |
| **Multi-Agent Engine** | None | 5 Autonomous Specialized Agents working in parallel |
| **Real Messaging** | Generic static SMS | **Real WhatsApp message delivery** to Security & Doctors |
| **Visual Mapping** | Static image | Interactive SVG satellite telemetry map with animated routes |
| **Human Safety Gate** | Uncontrolled | 30-Second Human Supervisor Gate with safety auto-escalation |

---

## 📱 Real WhatsApp Integration

Built using `whatsapp-web.js`, Campus SOS connects directly to WhatsApp Web to deliver real-time formatted markdown emergency notifications:

| Recipient | Target Phone Number | Automated Payload |
|---|---|---|
| 🏥 **Campus Doctor** | **`+91 6385710907`** | Medical emergency alert, patient symptoms, location node, & first-aid steps |
| 🔒 **Security HQ** | **`+91 7639277606`** | Tactical security dispatch briefing, priority level, gate access, & gear list |
| 📞 **Custom Contacts** | User-configured | Instant WhatsApp alerts sent to user-added custom numbers in Contact Matrix |

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3 Red Glassmorphism Design System, JavaScript (ES6 Modules), Orbitron Typography.
- **Backend**: Node.js, Express.js, WebSockets (`ws` library for real-time streaming).
- **AI Engine**: Google Gemini API (`@google/generative-ai`) + Rule Engine Fallback.
- **Messaging**: `whatsapp-web.js` + `qrcode` (real WhatsApp Web session persistence & message delivery).

---

## ⚙️ Local Installation & Setup

1. **Clone Repository**:
   ```bash
   git clone https://github.com/mid841098/MIND-MATRIX.git
   cd MIND-MATRIX
   ```

2. **Install Backend Dependencies**:
   ```bash
   cd backend
   npm install
   ```

3. **Start Application Server**:
   ```bash
   node server.js
   ```

4. **Access Web Application**:
   Open **`http://localhost:3001`** in your browser.

---

### *Engineered with excellence by TEAM MIND MATRIXX*
`CODE • INNOVATE • ELEVATE`

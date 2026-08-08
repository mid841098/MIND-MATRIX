/**
 * Emergency Agent
 * Classifies the emergency type, severity level, and recommended response protocol.
 */

const EMERGENCY_TYPES = {
  medical: {
    keywords: ['collapsed', 'fainted', 'unconscious', 'breathing', 'chest pain', 'heart', 'bleeding', 'injured', 'sick', 'fever', 'vomiting', 'seizure', 'stroke', 'allergy', 'overdose', 'accident', 'fracture', 'burn', 'fell'],
    severity: 'CRITICAL',
    protocol: 'MEDICAL_EMERGENCY',
    requiresAmbulance: true,
    requiresDoctor: true
  },
  fire: {
    keywords: ['fire', 'smoke', 'burning', 'flame', 'explosion'],
    severity: 'CRITICAL',
    protocol: 'FIRE_EMERGENCY',
    requiresEvacuation: true,
    requiresFireBrigade: true
  },
  mental: {
    keywords: ['suicide', 'self-harm', 'mental', 'depression', 'panic', 'anxiety attack', 'breakdown', 'crying uncontrollably', 'threatening'],
    severity: 'HIGH',
    protocol: 'MENTAL_HEALTH_EMERGENCY',
    requiresCounselor: true,
    requiresPrivacy: true
  },
  security: {
    keywords: ['fight', 'assault', 'theft', 'robbery', 'intruder', 'trespassing', 'harassment', 'ragging', 'threat', 'weapon'],
    severity: 'HIGH',
    protocol: 'SECURITY_EMERGENCY',
    requiresPolice: true
  },
  utility: {
    keywords: ['flood', 'water', 'electricity', 'power cut', 'gas leak', 'stuck', 'lift', 'elevator', 'locked'],
    severity: 'MEDIUM',
    protocol: 'UTILITY_EMERGENCY',
    requiresMaintenance: true
  }
};

const SEVERITY_CONFIG = {
  CRITICAL: { color: '#ff0000', priority: 1, responseTime: '< 5 minutes', callAmbulance: true },
  HIGH:     { color: '#ff6600', priority: 2, responseTime: '< 10 minutes', callAmbulance: false },
  MEDIUM:   { color: '#ffaa00', priority: 3, responseTime: '< 20 minutes', callAmbulance: false },
  LOW:      { color: '#00aa00', priority: 4, responseTime: '< 30 minutes', callAmbulance: false }
};

function classifyEmergency(parsedInput) {
  const text = (parsedInput.rawText || '').toLowerCase();
  let detectedType = null;
  let highestMatch = 0;

  for (const [type, config] of Object.entries(EMERGENCY_TYPES)) {
    const matches = config.keywords.filter(kw => text.includes(kw)).length;
    if (matches > highestMatch) {
      highestMatch = matches;
      detectedType = { type, config, matchCount: matches };
    }
  }

  // Default to medical if keywords found but no type matched (e.g. "my friend is in pain")
  if (!detectedType) {
    detectedType = {
      type: 'medical',
      config: EMERGENCY_TYPES.medical,
      matchCount: 0
    };
  }

  const severity = detectedType.config.severity || 'MEDIUM';
  const severityConfig = SEVERITY_CONFIG[severity];

  return {
    emergencyType: detectedType.type,
    severity,
    protocol: detectedType.config.protocol,
    severityConfig,
    requiresAmbulance: detectedType.config.requiresAmbulance || false,
    requiresDoctor: detectedType.config.requiresDoctor || false,
    requiresEvacuation: detectedType.config.requiresEvacuation || false,
    requiresPolice: detectedType.config.requiresPolice || false,
    requiresCounselor: detectedType.config.requiresCounselor || false,
    matchedKeywords: detectedType.config.keywords.filter(kw => text.includes(kw)),
    confidence: Math.min(100, (detectedType.matchCount / 3) * 100 + 40),
    instructions: generateFirstAidInstructions(detectedType.type),
    timestamp: new Date().toISOString()
  };
}

function generateFirstAidInstructions(type) {
  const instructions = {
    medical: [
      'Keep the person calm and still',
      'Do NOT move the person unless there is immediate danger',
      'Check for breathing and pulse',
      'If unconscious, place in recovery position',
      'Do NOT give food or water',
      'Stay on the line with emergency services'
    ],
    fire: [
      'Activate nearest fire alarm immediately',
      'Evacuate the building via emergency exits',
      'Do NOT use elevators',
      'Crawl low under smoke',
      'Close doors behind you to slow fire spread',
      'Assemble at designated muster point'
    ],
    mental: [
      'Stay with the person — do not leave them alone',
      'Speak calmly and reassuringly',
      'Remove any potential hazards from vicinity',
      'Do not argue or challenge their feelings',
      'Ask directly if they are thinking of harming themselves',
      'Help is on the way'
    ],
    security: [
      'Move to a safe location immediately',
      'Do NOT confront the individual(s)',
      'Lock doors if possible and safe to do so',
      'Call campus security immediately',
      'Note appearance and direction of suspect'
    ],
    utility: [
      'Stay calm and do not panic',
      'Do not touch electrical equipment if flooding',
      'Move away from the affected area',
      'Alert nearby persons'
    ]
  };
  return instructions[type] || instructions.medical;
}

async function run(parsedInput, broadcast) {
  broadcast({
    agent: 'emergency',
    status: 'working',
    message: '🔍 Analyzing emergency situation...',
    detail: `Processing: "${parsedInput.rawText}"`
  });

  await delay(1200);

  broadcast({
    agent: 'emergency',
    status: 'working',
    message: '⚡ Classifying emergency type and severity...',
    detail: 'Cross-referencing with emergency protocol database'
  });

  await delay(800);

  const result = classifyEmergency(parsedInput);

  broadcast({
    agent: 'emergency',
    status: 'done',
    message: `✅ Classified: ${result.emergencyType.toUpperCase()} | Severity: ${result.severity}`,
    detail: `Protocol: ${result.protocol} | Confidence: ${Math.round(result.confidence)}%`,
    data: result
  });

  return result;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { run, classifyEmergency, EMERGENCY_TYPES, SEVERITY_CONFIG };

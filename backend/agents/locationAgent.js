/**
 * Location Agent
 * Resolves campus location from natural language, finds nearest resources,
 * calculates distances, and determines optimal response routes.
 */

const campusMap = require('../data/campusMap.json');

function resolveLocation(rawText) {
  const text = rawText.toLowerCase();
  const blocks = campusMap.blocks;
  const aliases = campusMap.locationAliases;

  // Direct block name match (Block A, Block B, etc.)
  const blockMatch = text.match(/block\s*([a-z0-9]+)/i);
  if (blockMatch) {
    const blockId = `block-${blockMatch[1].toLowerCase()}`;
    const block = blocks.find(b => b.id === blockId);
    if (block) return { resolved: [block], method: 'direct_match', query: blockMatch[0] };
  }

  // Check for specific building names
  for (const block of blocks) {
    if (text.includes(block.name.toLowerCase()) || text.includes(block.label.toLowerCase())) {
      return { resolved: [block], method: 'name_match', query: block.name };
    }
  }

  // Check aliases
  for (const [alias, blockIds] of Object.entries(aliases)) {
    if (text.includes(alias)) {
      const resolved = blocks.filter(b => blockIds.includes(b.id));
      if (resolved.length > 0) {
        return { resolved, method: 'alias_match', query: alias };
      }
    }
  }

  // Floor/room pattern extraction
  const floorMatch = text.match(/floor\s*(\d+)|(\d+)(st|nd|rd|th)\s*floor/i);
  const roomMatch = text.match(/room\s*(?:no\.?\s*)?(\d+[a-z]?)/i);

  // Fallback: return hostel blocks as most likely location
  return {
    resolved: blocks.filter(b => b.type === 'hostel'),
    method: 'fallback_hostel',
    query: 'hostel area',
    floor: floorMatch ? parseInt(floorMatch[1] || floorMatch[2]) : null,
    room: roomMatch ? roomMatch[1] : null
  };
}

function euclideanDistance(a, b) {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

function findNearestResources(incidentBlock) {
  const blocks = campusMap.blocks;
  const cx = incidentBlock.x + incidentBlock.width / 2;
  const cy = incidentBlock.y + incidentBlock.height / 2;

  const medical = blocks.find(b => b.type === 'medical');
  const security = blocks.find(b => b.type === 'security');

  const medicalDist = medical ? Math.round(euclideanDistance({ x: cx, y: cy }, { x: medical.x + medical.width / 2, y: medical.y + medical.height / 2 }) * 0.5) : 999;
  const securityDist = security ? Math.round(euclideanDistance({ x: cx, y: cy }, { x: security.x + security.width / 2, y: security.y + security.height / 2 }) * 0.5) : 999;

  return {
    nearestMedical: { ...medical, distanceMeters: medicalDist, etaMinutes: Math.ceil(medicalDist / 80) },
    nearestSecurity: { ...security, distanceMeters: securityDist, etaMinutes: Math.ceil(securityDist / 100) },
    nearestGate: incidentBlock.nearestGate || 'Gate 1',
    vehicleParking: campusMap.vehicleParking
  };
}

async function run(parsedInput, emergencyResult, broadcast) {
  broadcast({
    agent: 'location',
    status: 'working',
    message: '📍 Resolving campus location...',
    detail: `Scanning for location references in: "${parsedInput.rawText}"`
  });

  await delay(900);

  const locationResolution = resolveLocation(parsedInput.rawText);

  if (!locationResolution.resolved || locationResolution.resolved.length === 0) {
    broadcast({
      agent: 'location',
      status: 'error',
      message: '⚠️ Could not resolve specific location',
      detail: 'Defaulting to campus-wide alert'
    });
    return { incidentBlock: campusMap.blocks[0], resources: findNearestResources(campusMap.blocks[0]), uncertain: true };
  }

  const incidentBlock = locationResolution.resolved[0];
  const resources = findNearestResources(incidentBlock);

  broadcast({
    agent: 'location',
    status: 'working',
    message: `🗺️ Located: ${incidentBlock.label}`,
    detail: `Nearest medical: ${resources.nearestMedical.name} (${resources.nearestMedical.distanceMeters}m away)`
  });

  await delay(700);

  const locationData = {
    incidentBlock,
    multipleBlocks: locationResolution.resolved.length > 1 ? locationResolution.resolved : null,
    floor: locationResolution.floor,
    room: locationResolution.room,
    resources,
    nearestGate: incidentBlock.nearestGate,
    method: locationResolution.method,
    accessNotes: generateAccessNotes(incidentBlock, resources),
    coordinates: {
      x: incidentBlock.x + incidentBlock.width / 2,
      y: incidentBlock.y + incidentBlock.height / 2
    }
  };

  broadcast({
    agent: 'location',
    status: 'done',
    message: `✅ Location confirmed: ${incidentBlock.label}`,
    detail: `Access via ${incidentBlock.nearestGate} | Medical Center ~${resources.nearestMedical.distanceMeters}m`,
    data: locationData
  });

  return locationData;
}

function generateAccessNotes(block, resources) {
  const notes = [];
  notes.push(`Enter campus via ${block.nearestGate}`);
  if (block.type === 'hostel') {
    notes.push(`Hostel reception is on ground floor`);
    notes.push(`Use main staircase or lift if available`);
  }
  notes.push(`Medical Center is ${resources.nearestMedical.distanceMeters}m away`);
  notes.push(`Security HQ is ${resources.nearestSecurity.distanceMeters}m away`);
  return notes;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { run, resolveLocation, findNearestResources };

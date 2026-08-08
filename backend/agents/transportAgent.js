/**
 * Transport Agent
 * Finds the best available campus vehicle or external ambulance,
 * dispatches it to the incident location, and tracks ETA.
 */

const vehicles = require('../data/vehicles.json');
const contacts = require('../data/contacts.json');

function selectBestVehicle(emergencyResult, locationData) {
  const available = vehicles.vehicles.filter(v => v.status === 'available');
  const severity = emergencyResult.severity;
  const requiresAmbulance = emergencyResult.requiresAmbulance;

  if (available.length === 0) {
    return { vehicle: null, useExternal: true, reason: 'No campus vehicles available' };
  }

  // For critical/medical — prefer ambulance
  if (requiresAmbulance || severity === 'CRITICAL') {
    const ambulance = available.find(v => v.type === 'ambulance');
    if (ambulance) return { vehicle: ambulance, useExternal: false, reason: 'Campus ambulance available' };
    // No campus ambulance — use external
    return {
      vehicle: available[0],
      useExternal: true,
      externalDetails: contacts.emergency,
      reason: 'Campus ambulance unavailable, dispatching external + golf cart'
    };
  }

  // For HIGH severity — prefer van or golf cart
  if (severity === 'HIGH') {
    const van = available.find(v => v.type === 'van');
    if (van) return { vehicle: van, useExternal: false, reason: 'Emergency van dispatched' };
    const cart = available.find(v => v.type === 'golf_cart');
    if (cart) return { vehicle: cart, useExternal: false, reason: 'Golf cart dispatched' };
  }

  // Default — nearest available
  const sorted = available.sort((a, b) => a.eta - b.eta);
  return { vehicle: sorted[0], useExternal: false, reason: 'Nearest vehicle dispatched' };
}

function calculateRoute(vehicle, locationData) {
  const block = locationData?.incidentBlock;
  if (!vehicle || !block) return null;

  return {
    from: vehicle.location,
    to: `${block.label}`,
    viaGate: block.nearestGate,
    estimatedDriveTime: vehicle.eta,
    totalETA: vehicle.eta + 1, // +1 min for boarding
    waypoints: [vehicle.location, block.nearestGate, block.label],
    specialInstructions: `Pull up to main entrance of ${block.label}. Do not block emergency exit.`
  };
}

async function run(emergencyResult, locationData, incidentId, broadcast, requiresSupervisorApproval) {
  broadcast({
    agent: 'transport',
    status: 'working',
    message: '🚑 Scanning available campus vehicles...',
    detail: `Checking fleet of ${vehicles.vehicles.length} vehicles`
  });

  await delay(900);

  const { vehicle, useExternal, externalDetails, reason } = selectBestVehicle(emergencyResult, locationData);

  broadcast({
    agent: 'transport',
    status: 'working',
    message: `🔎 Selected: ${vehicle ? vehicle.name : 'External Ambulance'}`,
    detail: reason
  });

  await delay(700);

  // External ambulance requires supervisor approval
  if (useExternal && emergencyResult.severity === 'CRITICAL') {
    broadcast({
      agent: 'transport',
      status: 'awaiting',
      message: '⏳ Calling external ambulance (108) — requires supervisor approval',
      detail: 'High-risk action: contacting external emergency services',
      requiresApproval: true,
      approvalAction: {
        id: `approve-ambulance-${incidentId}`,
        type: 'external_ambulance',
        description: 'Call external ambulance (108) for CRITICAL medical emergency',
        details: `Incident: ${incidentId} | Location: ${locationData?.incidentBlock?.label}`,
        riskLevel: 'HIGH'
      }
    });

    // Wait for approval signal (handled by coordinator)
    const approved = await requiresSupervisorApproval({
      id: `approve-ambulance-${incidentId}`,
      type: 'external_ambulance',
      description: 'Call external ambulance (108)',
      timeout: 30000
    });

    if (approved) {
      broadcast({
        agent: 'transport',
        status: 'working',
        message: '✅ Supervisor approved — Calling ambulance 108...',
        detail: `Notifying ${contacts.emergency.ambulance} — City Emergency Services`
      });
      await delay(800);
    } else {
      broadcast({
        agent: 'transport',
        status: 'working',
        message: '⚠️ External ambulance rejected — Using campus vehicle',
        detail: 'Deploying nearest campus vehicle as alternative'
      });
    }
  }

  const route = calculateRoute(vehicle, locationData);

  if (vehicle) {
    broadcast({
      agent: 'transport',
      status: 'working',
      message: `📞 Contacting driver: ${vehicle.driver}`,
      detail: `Phone: ${vehicle.driverPhone} | Vehicle: ${vehicle.registration}`
    });
    await delay(600);
  }

  const result = {
    vehicle,
    useExternalAmbulance: useExternal,
    externalDetails: useExternal ? contacts.externalAmbulance : null,
    route,
    dispatchTime: new Date().toISOString(),
    estimatedArrival: route ? `${route.totalETA} minutes` : 'Coordinating...',
    equipped: vehicle?.equipped || [],
    driverContacted: true,
    actionLog: [
      `${new Date().toLocaleTimeString()} — Fleet scan complete`,
      vehicle ? `${new Date().toLocaleTimeString()} — ${vehicle.name} dispatched from ${vehicle.location}` : null,
      vehicle ? `${new Date().toLocaleTimeString()} — Driver ${vehicle.driver} confirmed en route` : null,
      useExternal ? `${new Date().toLocaleTimeString()} — External ambulance (108) called` : null
    ].filter(Boolean)
  };

  broadcast({
    agent: 'transport',
    status: 'done',
    message: `✅ ${vehicle?.name || 'External Ambulance'} dispatched`,
    detail: `ETA: ${result.estimatedArrival} | Driver: ${vehicle?.driver || 'City EMS'}`,
    data: result
  });

  return result;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { run, selectBestVehicle, calculateRoute };

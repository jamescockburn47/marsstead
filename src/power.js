// Power — the pure thermostat, no THREE, no DOM. verify-power.mjs guards
// it. STRUCTURE.md: supply is FORECASTABLE (solar rides the sun and the
// deterministic dust cycle), demand is LEGIBLE (every load has a name),
// and deficit is never lethal — the bank drains, then loads shed in a
// fixed priority order and the base goes QUIET, never dead. The lander's
// RTG is the floor that keeps "quiet" from meaning "cold and dark".

// ---- units: abstract kilowatts; a sol of arithmetic a player can hold --
export const RTG_KW = 1.0;          // the lander's steady gift
export const ARRAY_KW = 3.0;        // one array, noon, clear sky
export const BATTERY_CAP = 12.0;    // kWh-ish per bank
export const LOADS = {
  drone: 1.0,      // per drone, while the queue runs — three hands digging
                   // at night OUTDRAW the RTG: banks or no midnight mining
  fab: 0.8,        // per station, while cooking
  smelter: 1.0,
  electrolyser: 0.8,
  mill: 1.4,
  assembler: 1.8,
  warrenRoom: 0.15, // per dug room, once the ring holds
};
// the shed ladder: first named, first darkened. Comfort last.
export const SHED_ORDER = ['assembler', 'mill', 'electrolyser', 'smelter', 'fab', 'drone', 'warren'];

// solar output factor for one array: sun elevation drives the curve, dust
// eats it linearly to nothing by deep storm. Night is exactly zero.
export function solarFactor(sunEl, tau) {
  const sun = Math.max(0, Math.sin(Math.max(0, sunEl) * Math.PI / 180));
  const dust = Math.max(0, 1 - tau * 0.55);
  return sun * dust;
}

// the lander's own cells: a small built-in bank (it flew here on them),
// half-charged at landfall — the float the whole first base is built on.
// Without it the currency deadlocks: batteries cost charge that only
// batteries could hold.
export const LANDER_BANK_KWH = 6;

export function createPower() {
  // the descent burn spent the rest: enough to break the first ground
  // (the shaft, exactly), not enough for a bench — income before ambition
  return { charge: 4 };
}

export function capacity(batteries) { return LANDER_BANK_KWH + batteries * BATTERY_CAP; }

export function supplyKw(arrays, sunEl, tau) {
  return RTG_KW + arrays * ARRAY_KW * solarFactor(sunEl, tau);
}

// demand, itemised — loads: { drones, cooking: {fab:0|1, smelter:n…},
// warrenRooms } — returns [{ name, kw }] in shed-ladder order (comfort
// last), so the ledger and the shedder read one list.
export function demandLedger(loads) {
  const out = [];
  for (const name of SHED_ORDER) {
    if (name === 'drone') {
      if (loads.drones > 0) out.push({ name, kw: loads.drones * LOADS.drone });
    } else if (name === 'warren') {
      if (loads.warrenRooms > 0) out.push({ name, kw: loads.warrenRooms * LOADS.warrenRoom });
    } else if (loads.cooking && loads.cooking[name]) {
      out.push({ name, kw: loads.cooking[name] * LOADS[name] });
    }
  }
  return out;
}

// one tick: charge the bank on surplus, drain it on deficit, and when the
// bank is dry shed loads up the ladder until the books balance. Returns
// { supply, demand, served, shed:[names], charge, capacity } — the whole
// truth, for the consoles and the instrument channel. dt in HOURS-ish
// (the caller scales sim seconds; the units only need to be consistent).
export function tickPower(p, dtH, arrays, batteries, sunEl, tau, loads) {
  const supply = supplyKw(arrays, sunEl, tau);
  const ledger = demandLedger(loads);
  const cap = capacity(batteries);
  const shed = [];
  let need = ledger.reduce((a, l) => a + l.kw, 0);

  // can the bank + supply carry the full ledger this tick?
  let net = supply - need;
  let i = 0;
  while (net < 0 && p.charge + net * dtH < 0 && i < ledger.length) {
    // dry: darken the ladder head, re-balance, try again
    const drop = ledger[i++];
    shed.push(drop.name);
    need -= drop.kw;
    net = supply - need;
  }
  p.charge = Math.max(0, Math.min(cap, p.charge + net * dtH));
  return {
    supply: +supply.toFixed(2),
    demand: +ledger.reduce((a, l) => a + l.kw, 0).toFixed(2),
    served: +need.toFixed(2),
    shed,
    charge: +p.charge.toFixed(3),
    capacity: cap,
  };
}

// ---- power as the CURRENCY of building (James's rule): the nanofab
// spends the bank for every placement — matter comes from the spoil,
// structure comes from the charge. Costs in bank-kWh, legible integers.
export const BUILD_KWH = {
  machine: 6,     // any placed bench, array or bank
  steadPart: 2,   // a wall, roof or surface part
  drone: 5,       // commissioning a new hand at the crown
};

// spend from the bank; refuses rather than overdrafts — the player builds
// income and storage BEFORE ambition, which is the whole scaling game
export function spend(p, kwh) {
  if (p.charge < kwh) return false;
  p.charge = +(p.charge - kwh).toFixed(6);
  return true;
}

export function serializePower(p) { return { charge: +p.charge.toFixed(3) }; }
export function deserializePower(raw) {
  const p = createPower();
  if (raw && Number.isFinite(raw.charge)) p.charge = Math.max(0, raw.charge);
  return p;
}

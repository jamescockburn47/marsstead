// Explicit game telemetry only. Never read dialogue, DOM text or arbitrary
// object fields into the live prompt. Null means the subsystem is unavailable.
import { BURROW_PIECES } from './burrow.js';
import { ITEMS } from './inventory.js';
import { MACHINE_TYPES } from './machines.js';
import { equipmentEfficiency } from './weather.js';
import { canOpenCrew } from './crew-control.js';
import { weatherCrewCommandAllowed } from './weather-session.js';

export const VESPER_CONTEXT_MAX = 600;
const known = (catalogue, key) => typeof key === 'string' && Object.hasOwn(catalogue, key);
const number = value => Number.isFinite(value) ? +value.toFixed(2) : null;
const boolean = value => typeof value === 'boolean' ? value : null;
const choice = (value, allowed) => allowed.includes(value) ? value : null;
const point = value => Number.isFinite(value?.x) && Number.isFinite(value?.z)
  ? `${number(value.x)},${number(value.z)}` : null;
const keyOf = key => typeof key === 'string' && /^-?\d{1,2},\d{1,2}$/.test(key) ? key : null;
const percent = value => Number.isFinite(value) && value >= 0 && value <= 1 ? Math.round(value * 100) : null;
function pack(entries) {
  const parts = entries.filter(value => value !== null);
  if (!parts.length) return null;
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    const next = out + (out ? '; ' : '') + parts[i];
    const suffix = `; ${parts.length - i} more entries omitted`;
    if (next.length > VESPER_CONTEXT_MAX - 30) return out ? out + suffix : 'Context entry exceeds limit';
    out = next;
  }
  return out;
}
function itemEntries(slots) {
  if (!slots || typeof slots !== 'object') return null;
  return Object.keys(ITEMS).filter(id => Number.isSafeInteger(slots[id]) && slots[id] > 0)
    .map(id => `${id}=${slots[id]}`);
}
function cargo(label, slots) {
  const entries = itemEntries(slots);
  return entries === null ? [] : entries.length ? entries.map(item => `${label} ${item}`) : [`${label} empty`];
}
function queue(label, station) {
  if (!station || !Array.isArray(station.queue)) return [];
  const counts = {};
  for (const id of station.queue) if (known(ITEMS, id)) counts[id] = (counts[id] || 0) + 1;
  return [`${label} next=${known(ITEMS, station.queue[0]) ? station.queue[0] : null} queued=${Object.keys(counts).sort().map(id => `${id}×${counts[id]}`).join(',') || 'empty'} progressSeconds=${number(station.t)}`,
    ...cargo(`${label} output`, station.out)];
}
function location(g) {
  if (g.habitat?.active === true) {
    const room = g.habitat.room;
    return `habitat ${known(BURROW_PIECES, room?.piece) ? room.piece : 'room unknown'} ${keyOf(room?.key)}`;
  }
  if (g.under?.active === true) return 'workings';
  if (g.inLander === true) return 'ship cabin';
  if (g.hopFlight) return 'ship flight';
  if (g.driving === true) return 'open rover';
  if (g.insidePressurised === true) return 'sealed surface structure';
  return point(g.pos) === null ? null : 'surface';
}
function sheltered(g) {
  if (g.inLander === true || g.insidePressurised === true
    || g.habitat?.active === true && g.burrow?.ringInstalled === true) return true;
  return g.inLander === false && g.insidePressurised === false
    && (g.habitat?.active === false || g.habitat?.active === true && g.burrow?.ringInstalled === false) ? false : null;
}
function conditionStatus(label, condition, sunEl, storage = false, rover = false) {
  if (!condition || typeof condition !== 'object') return `${label} condition=null`;
  const cover = boolean(condition.secured), dust = percent(condition.dust);
  let efficiency = null;
  if (cover !== null && dust !== null && (cover || condition.dust >= .6 || Number.isFinite(sunEl))) {
    efficiency = percent(equipmentEfficiency(condition, sunEl));
  }
  if (rover) return `${label} covered=${cover} dustPercent=${dust} weatherBoardable=${cover === null ? null : !cover} driveThrottlePercent=${cover === false && efficiency !== null ? Math.max(40, efficiency) : null}`;
  return `${label} covered=${cover} dustPercent=${dust} ${storage ? 'storage=connected' : `conditionEfficiencyPercent=${efficiency}`}`;
}
function crewReach(g) {
  const positionKnown = !g.habitat?.active && !g.under?.active && !g.hopFlight
    && point(g.pos) !== null && point(g.crownPos) !== null;
  const player = positionKnown ? { x: g.pos.x - g.crownPos.x, z: g.pos.z - g.crownPos.z } : null;
  const homeDistance = player ? Math.hypot(player.x, player.z) : null;
  const bots = Array.isArray(g.crownLayer?.drones) ? g.crownLayer.drones
    .filter(bot => bot.visible === true && point(bot.position) !== null)
    .map(bot => ({ x: bot.position.x, z: bot.position.z, visible: true })) : null;
  const nearest = player && bots?.length ? Math.min(...bots.map(bot => Math.hypot(player.x - bot.x, player.z - bot.z))) : null;
  const held = g.weather?.crewSecured || g.weatherNow?.phase === 'storm' || g.weather?.crewCondition?.dust >= .6;
  const blocked = !!(held || g.weatherSession?.visible || g.paused || g.attract || g.inLander || g.driving
    || g.hopFlight || g.airborne || g.buildMode || g.habitat?.active || g.under?.active || g.under?.ui?.visible
    || g.sleepAnim || g.cycling || g.map?.visible || g.journalUI?.visible || g.orders?.visible
    || g.fieldUI?.visible || g.burrowUI?.visible || g.worksUI?.visible || g.hopUI?.visible
    || g.chatBar?.style?.display === 'block');
  const localAllowed = blocked ? false : player && bots ? canOpenCrew(g.opening, player, bots, false) : null;
  // Use the actual weather command guard with read-only data adapters; never
  // invoke the game's mutating weatherTargets/advanceWeatherNow methods.
  const recallAllowed = g.weather && Number.isFinite(g.droneCount) && location(g) !== null
    ? g.droneCount > 0 && weatherCrewCommandAllowed({ ...g,
      weatherSheltered: () => sheltered(g) === true, distToCrown: () => homeDistance ?? Infinity }) : null;
  return `playerHomeDistance=${number(homeDistance)} crewNearestMeters=${number(nearest)} localCrewCommandAllowed=${localAllowed} recallHereAllowed=${recallAllowed}`;
}

export function dynamicVesperContext(g = {}) {
  g ||= {};
  const cells = g.burrow?.cells instanceof Map ? [...g.burrow.cells]
    .filter(([key, cell]) => keyOf(key) && known(BURROW_PIECES, cell?.piece))
    .sort(([a], [b]) => {
      const [ac, ad] = a.split(',').map(Number), [bc, bd] = b.split(',').map(Number);
      return ad - bd || ac - bc;
    }) : null;
  const machines = Array.isArray(g.machines) ? g.machines.filter(machine => known(MACHINE_TYPES, machine?.type)) : null;
  const opening = g.opening?.version === 1 ? g.opening : null;
  const home = [];
  if (cells) {
    const position = g.habitat?.active ? g.habitat.pos : g.under?.active ? g.under.pos : g.pos;
    home.push(`location=${location(g)} player@${point(position)} ringInstalled=${boolean(g.burrow.ringInstalled)} finishedCells=${cells.filter(([, c]) => c.dug >= 1).length}`);
    if (opening) home.push(`arrival=v1 visitedHome=${boolean(opening.visitedHome)} followed=${boolean(opening.followed)} worked=${boolean(opening.worked)}`);
    home.push(...cells.filter(([, cell]) => cell.dug >= 1).map(([key, cell]) => `${key} ${cell.piece} complete`));
  }
  const construction = [];
  if (Array.isArray(g.burrow?.queue) && cells) {
    construction.push(`excavationQueued=${g.burrow.queue.length}`);
    for (const key of g.burrow.queue) {
      const cell = g.burrow.cells.get(key);
      if (keyOf(key) && known(BURROW_PIECES, cell?.piece)) construction.push(`${key} ${cell.piece} dugPercent=${percent(cell.dug)} funded=${boolean(cell.funded)} waitingCharge=${boolean(cell.waiting)}`);
    }
  }
  if (g.grid) construction.push(`grid charge=${number(g.grid.charge)} capacity=${number(g.grid.capacity)} supply=${number(g.grid.supply)} demand=${number(g.grid.demand)} served=${number(g.grid.served)}`);
  construction.push(...queue('fabricator', g.fab));
  for (const [i, machine] of (machines || []).entries()) construction.push(...queue(`${machine.type}#${i + 1}`, machine));
  const mode = opening ? choice(opening.fleetMode, ['park', 'follow', 'work']) : g.opening === null ? 'auto' : null;
  const crew = Number.isFinite(g.droneCount) || opening || g.weather?.crewCondition ? [
    `commissioned=${number(g.droneCount)} mode=${mode} recalled=${boolean(g.weather?.crewSecured)}`,
    ['park','follow'].includes(mode) ? 'Excavation is PAUSED by crew command even when a passage is funded. Approach a worker near home to resume after weather permits.' : null,
    crewReach(g),
    conditionStatus('crew', g.weather?.crewCondition, g.sunEl),
  ] : [];
  const weather = g.weatherNow;
  if (crew.length && weather) crew.push(`stormHold=${weather.phase === 'storm'} gridDroneShed=${Array.isArray(g.grid?.shed) ? g.grid.shed.includes('drone') : null}`);
  const weatherStatus = weather ? pack([
    `phase=${choice(weather.phase, ['clear', 'warning', 'storm'])} intensity=${number(weather.intensity)} cold=${boolean(weather.cold)}`,
    `secondsToStorm=${number(weather.secondsToStorm)} secondsRemaining=${number(weather.secondsRemaining)} location=${location(g)} sealedShelter=${sheltered(g)}`,
  ]) : null;
  const equipment = [];
  if (g.weatherEquipment?.rover) equipment.push(conditionStatus('rover', g.weatherEquipment.rover, g.sunEl, false, true));
  if (g.weatherEquipment?.rig) equipment.push(conditionStatus('rig', g.weatherEquipment.rig, g.sunEl));
  for (const [i, machine] of (machines || []).entries()) {
    equipment.push(conditionStatus(`${machine.type}#${i + 1}@${point(machine)}`, machine.exposure, g.sunEl, machine.type === 'battery'));
  }
  const activity = g.activities, expedition = g.expedition;
  const activities = [];
  if (expedition) activities.push(`surveyWingClaimed=${boolean(expedition.claimed)} surveySolarInstalled=${boolean(expedition.complete)}`);
  if (activity) {
    activities.push(`worker=${choice(activity.worker, ['stranded', 'carried', 'bench', 'diagnosed', 'repaired', 'equipped', 'deployed'])} benchRoom=${keyOf(activity.benchRoom)} routeOpen=${boolean(activity.routeOpen)} routeProgressSeconds=${number(activity.routeProgress)}`,
      `crop=${choice(activity.crop?.phase, ['empty', 'planted', 'watered', 'ready'])} growthSeconds=${number(activity.crop?.growth)} cropRoom=${keyOf(activity.cropRoom)} harvests=${number(activity.harvests)} rations=${number(activity.rations)}`);
  }
  const vehicles = [];
  if (g.hopper || g.landerPos) vehicles.push(`shipPosition=${point(g.hopper) ?? point(g.landerPos)} fuelKg=${number(g.hopper?.fuelKg)} flightState=${choice(g.hopper?.state, ['parked', 'ascent', 'arc', 'descent'])}`);
  if (g.buggy) vehicles.push(`roverPosition=${point(g.buggy)} driving=${boolean(g.driving)} distanceFromHome=${point(g.buggy) !== null && point(g.crownPos) !== null ? number(Math.hypot(g.buggy.x - g.crownPos.x, g.buggy.z - g.crownPos.z)) : null}`);
  if (g.recall) vehicles.push(`roverRecallSeconds=${number(g.recall.rem)}`);
  if (g.rig) vehicles.push(`rigPosition=${point(g.rig)} deployed=${boolean(g.rig.deployed)} hitched=${boolean(g.rig.hitched)}`);
  if (g.sled) vehicles.push(`sledPosition=${point(g.sled)} hitched=${boolean(g.sled.hitched)}`);
  const inventory = [...cargo('suit', g.suit?.slots), ...cargo('rover', g.roverStore?.slots),
    ...cargo('shipHold', g.shipHold?.slots), ...cargo('sled', g.sled?.store?.slots), ...cargo('lander', g.lander?.stock)];
  if (g.burrow?.spoil) inventory.push(`uncollectedSpoil regolith=${number(g.burrow.spoil.regolith)} ore=${number(g.burrow.spoil.ore)}`);
  return { homeLayout: pack(home), constructionQueue: pack(construction), crewStatus: pack(crew), weatherStatus,
    equipmentStatus: pack(equipment), activityStatus: pack(activities), vehicleStatus: pack(vehicles), inventoryStatus: pack(inventory) };
}

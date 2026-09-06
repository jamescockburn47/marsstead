// Commands change fleet mode only. Excavation/material accounting stays in Burrow.
import { droneClass, fleetCounts } from './dronefleet.js';
export const CREW_HOME_RADIUS = 18;
export const CREW_REACH = 3.5;
export const CREW_DOCK = Object.freeze({ x: 5.7, z: -4.4 });
const MODES = new Set(['park', 'follow', 'work']);
const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.z);
export function crewMode(opening) {
  return opening == null ? 'auto' : MODES.has(opening.fleetMode) ? opening.fleetMode : 'park';
}
export function activeCrewCount(opening, count) {
  return ['auto', 'work'].includes(crewMode(opening)) && Number.isFinite(count) ? Math.max(0, count) : 0;
}
export function crewIdentity(index) {
  if (droneClass(index) === 'flying') return index === 2 ? 'Survey flyer 01' : `Flyer ${String(Math.floor(index / 3) + 1).padStart(2, '0')}`;
  return `Spider ${String(index - Math.floor((index + 1) / 3) + 1).padStart(2, '0')}`;
}
export function crewSummary(count) {
  const fleet = fleetCounts(count);
  return `${fleet.spider} ${fleet.spider === 1 ? 'spider' : 'spiders'} · ${fleet.flying} ${fleet.flying === 1 ? 'survey flyer' : 'flyers'}`;
}
export function crewDock(index) {
  const lane = Math.floor(index / 3), role = index % 3;
  return { x: CREW_DOCK.x + (role === 0 ? -.9 : role === 1 ? .9 : 0) + lane * .7,
    z: CREW_DOCK.z + (role === 2 ? 0 : 1.5) - lane * .65 };
}
export function crewTarget(mode, index, player, parked = null) {
  if (mode === 'park' && point(parked) && Math.hypot(parked.x, parked.z) <= CREW_HOME_RADIUS) return { ...parked };
  if (mode !== 'follow' || !point(player) || Math.hypot(player.x, player.z) > CREW_HOME_RADIUS) return crewDock(index);
  const heading = Number.isFinite(player.heading) ? player.heading : 0;
  const side = index % 3 === 0 ? -1.35 : index % 3 === 1 ? 1.35 : 0;
  const behind = 2.1 + Math.floor(index / 3) * .9;
  const x = player.x + Math.cos(heading) * side - Math.sin(heading) * behind;
  const z = player.z - Math.sin(heading) * side - Math.cos(heading) * behind;
  const scale = Math.min(1, (CREW_HOME_RADIUS - .5) / Math.max(.001, Math.hypot(x, z)));
  return { x: x * scale, z: z * scale };
}
export function moveCrew(current, target, dt, speed) {
  const dx = target.x - current.x, dz = target.z - current.z, distance = Math.hypot(dx, dz);
  const step = Math.min(distance, Math.max(0, Math.min(.1, dt)) * speed);
  const ratio = distance > .001 ? step / distance : 0;
  return { x: current.x + dx * ratio, z: current.z + dz * ratio,
    heading: distance > .01 ? Math.atan2(dx, dz) : null, speed: dt > 0 ? step / dt : 0 };
}
export function nearCrew(player, bots) {
  return point(player) && bots.some(bot => bot.visible && point(bot) && Math.hypot(player.x - bot.x, player.z - bot.z) <= CREW_REACH);
}
export function canOpenCrew(opening, player, bots, blocked = false) {
  return !blocked && opening?.version === 1 && point(player) &&
    Math.hypot(player.x, player.z) <= CREW_HOME_RADIUS && nearCrew(player, bots);
}
export function commandCrew(opening, mode, { player, bots, blocked = false }) {
  if (!MODES.has(mode) || !canOpenCrew(opening, player, bots, blocked) || !nearCrew(player, bots)) return false;
  opening.fleetMode = mode;
  if (mode === 'follow') opening.followed = true;
  if (mode === 'work') opening.worked = true;
  return true;
}

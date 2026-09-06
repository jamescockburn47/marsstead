// New-landfall state only. Legacy saves receive no opening state or starter gifts.
import { takeOne } from './salvage.js';
import { capacity } from './power.js';
import { createMachine } from './machines.js';
import { RESCUE_SITE } from './habitat-activities.js';
import { FIELD_SITE } from './fieldwork.js';

export const STARTER_HOME = Object.freeze([
  ['0,1', 'shaft'], ['-1,1', 'corridor'], ['1,1', 'corridor'],
  ['2,1', 'bunk'], ['-2,1', 'bay'], ['0,2', 'shaft'],
].map(Object.freeze));
export const OPENING_EXPANSION = '1,2';
const FLEET_MODES = ['park', 'follow', 'work'];

export function createOpening() {
  return { version: 1, visitedHome: false, followed: false, worked: false, fleetMode: 'park' };
}
export function acceptOpening(raw) {
  if (!raw || typeof raw !== 'object' || raw.version !== 1) return null;
  return { version: 1, visitedHome: raw.visitedHome === true,
    followed: raw.followed === true, worked: raw.worked === true,
    fleetMode: FLEET_MODES.includes(raw.fleetMode) ? raw.fleetMode : 'park' };
}
export function recordOpeningVisit(state) {
  if (!state || state.version !== 1 || state.visitedHome) return false;
  state.visitedHome = true;
  return true;
}

// Caller must select a genuinely new game, before rendering its home. Refuse
// an occupied warren atomically; the ring remains finite lander inventory.
export function seedStarterHome(game) {
  const { burrow, lander, power } = game;
  if (!(burrow?.cells instanceof Map) || burrow.cells.size || burrow.queue?.length
    || burrow.ringInstalled || !power || !Number.isFinite(power.charge)
    || !Array.isArray(game.machines) || !Number.isFinite(game.crownPos?.x) || !Number.isFinite(game.crownPos?.z)
    || !Number.isSafeInteger(lander?.stock?.['airlock-ring']) || lander.stock['airlock-ring'] < 1) return false;
  if (!takeOne(lander, 'airlock-ring')) return false;
  for (const [key, piece] of STARTER_HOME) {
    burrow.cells.set(key, { piece, dug: 1, planned: false, funded: true });
  }
  burrow.cells.set(OPENING_EXPANSION, { piece: 'corridor', dug: 0, planned: true, funded: true });
  burrow.queue = [OPENING_EXPANSION];
  burrow.ringInstalled = true;
  game.machines.push(createMachine('battery', game.crownPos.x - 7, game.crownPos.z + 1, 0));
  const batteries = (game.machines || []).filter(machine => machine.type === 'battery').length;
  power.charge = Math.min(12, capacity(batteries));
  game.opening = createOpening();
  return true;
}

// A suggestion, never permission to act: all other projects and trips remain
// available. Completion comes from the same cells, expedition and activities
// that the playable systems change, rather than a parallel tutorial inventory.
export function openingGoal(game) {
  const state = game.opening;
  if (!state || state.version !== 1) return null;
  const home = game.crownPos;
  const goal = (id, actionId, title, detail, action, reward, target = home, location = 'home') =>
    ({ id, actionId, title, detail, target, location, action, reward });
  if (!state.visitedHome) return goal('home', 'home', 'Your home is already here',
    'Walk to the shaft head and enter your buried habitat. Find your bunk and the workshop bench.',
    'Enter home', 'A warm, sealed home and a place to rest.');
  if (!state.followed) return goal('crew-follow', 'crew', 'Meet your working crew',
    'Return outside. Open CREW and choose Call over; take your three workers for a short walk.',
    'Open crew', 'Your workers come with you.');
  const expansionIncomplete = !(game.burrow.cells.get(OPENING_EXPANSION)?.dug >= 1);
  if (!state.worked || (expansionIncomplete && state.fleetMode !== 'work')) return goal('crew-work', 'crew', 'Give the crew its first job',
    'In CREW, choose Resume excavation. The marked passage beside the lower shaft is already paid for.',
    'Send crew to work', 'A new passage you can walk into.');
  if (expansionIncomplete) {
    return goal('home-expansion', 'home', 'Watch your home grow',
      'The crew is cutting the lower passage. At HOME, watch the marked corridor finish, then walk through it. If cancelled, plan a corridor to the right of the lower shaft.',
      'View the expansion', 'Space for your next room.');
  }
  if (!game.expedition?.claimed) return goal('survey', 'survey', 'Take the rover to the glint',
    'Drive to the survey station and align its three light sensors. Recover the solar wing, then check the disabled worker nearby.',
    'Find the station', 'A solar wing for your first array.', FIELD_SITE, 'survey station');
  const activities = game.activities;
  if (activities?.worker === 'stranded') return goal('worker-stranded', 'worker-stranded', 'Bring a worker home too',
    'Before leaving the survey station, find the disabled spider nearby. Walk close and press E to carry it home with the solar wing.',
    'Find the worker', 'One rover outing brings a solar wing and a worker for your bench.', RESCUE_SITE, 'field service hatch');
  if (!game.expedition?.complete) return goal('power', 'power', 'Put the sunlight to work',
    'Return home with the wing. Choose Solar array in BUILD and place it on level ground nearby.',
    'Build solar array', 'More power for your growing home.');
  if (activities && !activities.routeOpen) {
    const worker = activities.worker;
    const bench = {
      carried: ['Bring it to your bench', 'Enter your workshop. At the bench, press E to set the recovered worker down.'],
      bench: ['Find the damaged part', 'At the workshop bench, press E to inspect the damaged worker.'],
      diagnosed: ['Repair the worker', 'At the bench, press E to refit its disconnected drive coupling.'],
      repaired: ['Fit its excavation tool', 'At the bench, press E to equip the repaired worker with its excavation attachment.'],
    }[worker];
    if (bench) return goal('worker-' + worker, 'worker-' + worker, bench[0], bench[1],
      'Visit the workshop', 'A repaired worker can open a second route below.');
  }
  const garden = [...game.burrow.cells.values()].some(cell => cell.piece === 'garden' && cell.dug >= 1);
  if (!garden && state.fleetMode !== 'work') return goal('crew-garden', 'crew', 'Put the crew back on excavation',
    'In CREW, choose Resume excavation so your workers can dig the Garden Room when it is planned and funded.',
    'Resume excavation', 'Your crew can build the growing room.');
  if (!garden) return goal('home-garden', 'home', 'Make room for something green',
    ((game.machines || []).some(machine => machine.type === 'battery') ? '' : 'Add a battery bank to hold the 8 kWh construction charge. ')
      + 'At HOME, plan a shallow Garden Room beside a completed corridor. Your new solar array supplies its construction charge.',
    'Plan your garden', 'A growing bed and a stronger air loop.');
  if (!activities?.harvests) return goal('worker-crop', 'home', 'Grow your first expedition ration',
    'Enter the greenhouse and approach the growing bed. Press E to plant, water and harvest when ready.',
    'Visit the greenhouse', 'A packed ration for your next excursion.');
  if (activities && !activities.routeOpen) return goal('worker-' + activities.worker, 'worker-' + activities.worker,
    'Choose a new route below', activities.worker === 'equipped'
      ? 'When you want another trip, take the equipped worker to the field service hatch. Press E to deploy its auger.'
      : 'The worker is clearing the field hatch. Stay to watch, or continue a project at home while it finishes.',
    'Find the hatch', 'An optional second entrance to the workings.', RESCUE_SITE, 'field service hatch');
  return goal('worker-route', 'worker-route', 'Choose your next expedition',
    'Take the field hatch into the workings, plan another room, or drive toward an old mission on your map.',
    'Find the field hatch', 'More of Mars is yours to explore.', RESCUE_SITE, 'field service hatch');
}

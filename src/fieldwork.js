// First light: the landing survey's optical calibration, independent of UI/clock.
import { depositCosts } from './worksite.js';
import { RESCUE_SITE } from './habitat-activities.js';
import { openingGoal } from './opening.js';

export const FIELD_SITE = Object.freeze({ x: 108, z: -94, name: 'First light station' });
export const FIELD_TARGETS = Object.freeze([2, 5, 7]);
export const FIELD_BANDS = Object.freeze(['Horizon', 'Sky', 'Reflected light']);
export const FIELD_RADIUS = 7;
export function acceptFieldwork(value) {
  const dials = FIELD_TARGETS.map((_, i) => {
    const n = value?.dials?.[i];
    return Number.isInteger(n) && n >= 0 && n < 8 ? n : 0;
  });
  const claimed = value?.claimed === true;
  return { dials, claimed, complete: claimed && value?.complete === true };
}
export function alignment(dial, target) {
  return (1 + Math.cos((dial - target) * Math.PI / 4)) / 2;
}
export function fieldAligned(state) {
  return FIELD_TARGETS.every((target, i) => state.dials[i] === target);
}
export function turnDial(state, index, direction) {
  if (state.claimed || !Number.isInteger(index) || index < 0 || index > 2
    || ![-1, 1].includes(direction)) return false;
  state.dials[index] = (state.dials[index] + direction + 8) % 8;
  return true;
}
export function collectFieldwork(state, stores) {
  if (state.claimed || !fieldAligned(state)) return false;
  if (!depositCosts(stores, [['solar-wing', 1]])) return false;
  state.claimed = true;
  return true;
}
export function fieldDistance(position) {
  return Math.hypot(position.x - FIELD_SITE.x, position.z - FIELD_SITE.z);
}

// One current goal, derived from actual state rather than elapsed briefing timers.
export function firstLightGoal(game) {
  const opening = openingGoal(game);
  if (opening) return opening;
  const cells = [...game.burrow.cells.values()];
  const state = game.expedition;
  const home = game.crownPos;
  if (!cells.length) return { id: 'plan', title: 'Make your first mark on Mars',
    detail: 'Go to the glowing shaft head. Press E to open your home and plan a shaft.',
    target: home, action: 'Find home', reward: 'Your drones begin digging.' };
  if (!state.claimed) return { id: 'survey', title: 'Follow the glint',
    detail: 'Take the buggy to the survey station. Align three light sensors and bring its solar wing home.',
    target: FIELD_SITE, action: 'Find the station', reward: 'A solar wing to power your home.' };
  if (!state.complete) return { id: 'power', title: 'Bring the light home',
    detail: 'Return to the shaft head. Choose Solar array in BUILD; place it on level ground nearby.',
    target: home, action: 'Build solar array', reward: 'More sunlight becomes more digging power.' };
  if (!game.burrow.ringInstalled) return { id: 'ring', title: 'Give your home a front door',
    detail: 'At HOME, fit the airlock ring from the nearby lander.',
    target: home, action: 'Find home', reward: 'Your first room can hold air.' };
  if (!cells.some(c => c.piece === 'bunk' && c.dug >= 1)) return { id: 'bunk',
    title: 'A place of your own', detail: 'At HOME, extend the shaft with a corridor and a bunk.',
    target: home, action: 'Find home', reward: 'A sheltered place to rest, with your survey on display.' };
  if (game.activities && !game.activities.routeOpen) {
    const worker = game.activities.worker, field = ['stranded','equipped','deployed'].includes(worker);
    return {id:'worker-'+worker, title:worker==='stranded'?'Bring a worker home':field?'Open a new way below':'Give the worker a second life',
      detail:worker==='stranded'?'Find the disabled spider beside the survey station. Walk close and press E to carry it home.':field?'Take the equipped worker back to the field service hatch. Press E to deploy its auger.':
        'Build a workshop (bay) in your sealed home. Walk to its bench; E places, diagnoses, repairs and equips the recovered worker.',
      target:field?RESCUE_SITE:home,location:field?'field service hatch':'home',action:field?'Find the hatch':'Visit the workshop',reward:'A second entrance into the workings, away from home.'};
  }
  if (game.activities && !game.activities.harvests) return {id:'first-crop',title:'Grow your first expedition ration',
    detail:'Build a greenhouse in your sealed home. Walk to the small nursery pot: E plants, waters and harvests when ready.',
    target:home,action:'Visit the greenhouse',reward:'A packed tomato ration reduces air use for one Mars hour.'};
  if (!game.underworld?.returned) return { id: 'under', title: 'What are the workers building?',
    detail: 'Your home is ready. At the shaft, choose Explore the workings and follow the machines below.',
    target: home, action: 'Explore the workings', reward: 'A new discovery can improve your worker coordination.' };
  return { id: 'next', title: 'What shall we make next?',
    detail: 'Try a shallow garden beside your bunk, or take the buggy to the old mission on your map.',
    target: home, action: 'Plan a garden', reward: 'Gardens improve air; expeditions bring useful materials.' };
}

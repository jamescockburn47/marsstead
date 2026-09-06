// Small, deterministic home activities. Progress advances only in active simulation.
export const ROUTE_SECONDS = 12;
export const CROP_SECONDS = 60;
export const RESCUE_SITE = Object.freeze({ x: 118, z: -87 });
const WORKERS = ['stranded', 'carried', 'bench', 'diagnosed', 'repaired', 'equipped', 'deployed'];
const CROPS = ['empty', 'planted', 'watered', 'ready'];
const bounded = (value, max) => Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : 0;
const roomKey = value => typeof value === 'string' && /^-?\d{1,2},\d{1,2}$/.test(value) ? value : null;

export function acceptHabitatActivities(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const worker = WORKERS.includes(source.worker) ? source.worker : 'stranded';
  const savedCrop = source.crop && typeof source.crop === 'object' ? source.crop : { phase: source.crop, growth: source.growth };
  let crop = CROPS.includes(savedCrop.phase) ? savedCrop.phase : 'empty';
  const routeProgress = worker === 'deployed' ? bounded(source.routeProgress, ROUTE_SECONDS) : 0;
  let growth = crop === 'watered' || crop === 'ready' ? bounded(savedCrop.growth, CROP_SECONDS) : 0;
  // A ready crop is itself evidence of completion in this version of the save.
  if (crop === 'ready') growth = CROP_SECONDS;
  if (growth === CROP_SECONDS) crop = 'ready';
  return { worker, routeProgress, routeOpen: routeProgress === ROUTE_SECONDS, crop: { phase: crop, growth },
    harvests: Math.floor(bounded(source.harvests, 999)), rations: Math.floor(bounded(source.rations, 9)),
    benchRoom: roomKey(source.benchRoom), cropRoom: roomKey(source.cropRoom) };
}

// A new earlier-sorted room must not move a player's worker or planted crop.
export function bindActivityRooms(state, rooms) {
  let changed = false;
  for (const [field, piece] of [['benchRoom','bay'],['cropRoom','garden']]) {
    if (rooms.some(r => r.key === state[field] && r.piece === piece)) continue;
    const key = rooms.find(r => r.piece === piece)?.key || null;
    if (key !== state[field]) { state[field] = key; changed = true; }
  }
  return changed;
}

const fail = message => ({ ok: false, message });
const success = message => ({ ok: true, message });
const BENCH_ACTIONS = ['bench', 'diagnose', 'repair', 'equip'];
const CROP_ACTIONS = ['plant', 'water', 'harvest'];
const KNOWN_ACTIONS = ['rescue', ...BENCH_ACTIONS, ...CROP_ACTIONS, 'deploy', 'eat'];

export function activityAction(state, action, context = {}) {
  if (context.paused) return fail('Resume play to continue.');
  if (!KNOWN_ACTIONS.includes(action)) return fail('Unknown activity.');
  if (![ 'rescue', 'deploy', 'eat' ].includes(action) && !context.sealed) return fail('This activity needs a sealed habitat.');
  if (action === 'rescue' && !context.nearWorker) return fail('Move closer to the stranded worker.');
  if (BENCH_ACTIONS.includes(action) && !context.nearBench) return fail('Move closer to the workbench.');
  if (CROP_ACTIONS.includes(action) && !context.nearCrop) return fail('Move closer to the growing bed.');
  if (action === 'deploy' && !context.nearHatch) return fail('Take the equipped worker to the workings hatch.');
  switch (action) {
    case 'rescue':
      if (state.worker !== 'stranded') return fail('The worker has already been recovered.');
      state.worker = 'carried';
      return success('Worker recovered. Carry it to the habitat workbench.');
    case 'bench':
      if (state.worker !== 'carried') return fail('Bring the recovered worker to the bench first.');
      state.worker = 'bench';
      return success('Worker placed on the bench. Inspect its damaged drive.');
    case 'diagnose':
      if (state.worker !== 'bench') return fail('Place the worker on the bench before inspecting it.');
      state.worker = 'diagnosed';
      return success('Drive coupling disconnected. The salvaged coupling can be refitted.');
    case 'repair':
      if (state.worker !== 'diagnosed') return fail('Inspect the damaged drive first.');
      state.worker = 'repaired';
      return success('Coupling refitted. Fit the excavation attachment next.');
    case 'equip':
      if (state.worker !== 'repaired') return fail('Repair the drive before fitting the attachment.');
      state.worker = 'equipped';
      return success('Excavation attachment fitted. Take the worker to the workings hatch.');
    case 'deploy':
      if (state.worker !== 'equipped') return fail('Repair and equip the worker first.');
      state.worker = 'deployed';
      state.routeProgress = 0;
      state.routeOpen = false;
      return success('Worker deployed. Clearing the blocked route.');
    case 'plant':
      if (state.crop.phase !== 'empty') return fail('This bed already has a crop.');
      state.crop.phase = 'planted';
      state.crop.growth = 0;
      return success('Seed planted. Water the bed to begin growing.');
    case 'water':
      if (state.crop.phase !== 'planted') return fail('Plant a seed before watering.');
      state.crop.phase = 'watered';
      return success('Bed watered. The crop will grow while you explore.');
    case 'harvest':
      if (state.crop.phase !== 'ready') return fail('The crop is not ready to harvest.');
      if (state.rations >= 9) return fail('Your food pack is full. Eat a ration before harvesting.');
      state.crop.phase = 'empty';
      state.crop.growth = 0;
      state.harvests = Math.min(999, state.harvests + 1);
      state.rations += 1;
      return success('Harvest packed. One fresh ration is ready to eat.');
    case 'eat':
      if (state.rations < 1) return fail('Harvest a crop to prepare a ration.');
      state.rations -= 1;
      return success('Fresh ration eaten.');
  }
}

export function tickHabitatActivities(state, dt, context = {}) {
  if (context.paused) return;
  const seconds = bounded(dt, .25);
  if (state.worker === 'deployed' && !state.routeOpen) {
    state.routeProgress = Math.min(ROUTE_SECONDS, state.routeProgress + seconds);
    state.routeOpen = state.routeProgress === ROUTE_SECONDS;
  }
  if (state.crop.phase === 'watered' && context.sealed && context.gardenPresent) {
    state.crop.growth = Math.min(CROP_SECONDS, state.crop.growth + seconds);
    if (state.crop.growth === CROP_SECONDS) state.crop.phase = 'ready';
  }
}

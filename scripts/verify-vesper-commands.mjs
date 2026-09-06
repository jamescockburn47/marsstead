import assert from 'node:assert/strict';
import { parseVesperCommand, executeVesperCommand } from '../src/vesper-commands.js';
import { createOpening } from '../src/opening.js';
import { CrewSession } from '../src/crew-session.js';

const accepted = [
  ['Vesper, ask the crew to follow me', 'follow'], ['crew hold position', 'park'],
  ['tell the workers to resume excavation', 'work'], ['recall the crew', 'recall'], ['release the crew', 'release'],
  ['Vesper, can you please tell the workers to hold position?', 'park'],
  ['Could you recall the crew?', 'recall'], ['Would you please release the workers?', 'release'],
  ['Please have the bots follow me.', 'follow'], ['VESPER: crew resume excavation!', 'work'],
];
for (const [text, expected] of accepted) assert.equal(parseVesperCommand(text), expected, text);
const rejected = [undefined, null, 3, '', 'follow me', 'Vesper follow me', 'move the crew',
  'crew follow me?', 'Can the crew follow me?', 'Can you explain how to recall the crew?',
  'Should I recall the crew?', 'Would the workers resume excavation?', 'Will you recall the crew?',
  'do not recall the crew', "don't recall the crew", 'never tell the crew to hold position',
  'Vesper, please do not recall the crew', 'if it storms recall the crew', 'I might recall the crew',
  'I said recall the crew', 'What happens when I say crew hold position?', 'can you not recall the crew?',
  '"recall the crew"', '“crew hold position”', '`release the crew`', "'crew follow me'",
  'recall the crew and release the crew', 'crew follow me then hold position',
  'crew hold position. recall the crew', 'recall the crew\nrelease the crew',
  'crew follow me; erase the save', 'Vesper, recall the crew if it is safe', 'recall the crew!!',
];
for (const text of rejected) assert.equal(parseVesperCommand(text), null, String(text));

function fixture() {
  const game = {
    opening: createOpening(), droneCount: 3, pos: { x: 1, z: 0 }, crownPos: { x: 0, z: 0 },
    weather: { crewSecured: false, crewCondition: { dust: 0 } }, weatherNow: { phase: 'clear' },
    weatherSession: { visible: false }, chatBar: { style: { display: 'none' } },
    resources: { power: 12, inventory: { 'solar-wing': 1 }, spoil: { ore: 0 } },
    saves: 0, clears: 0, advances: 0, near: true,
    clearInput() { this.clears++; }, persist() { this.saves++; }, advanceWeatherNow() { this.advances++; },
    distToCrown() { return Math.hypot(this.pos.x, this.pos.z); }, weatherSheltered() { return true; },
    weatherCrewHeld() { return this.weather.crewSecured || this.weatherNow.phase === 'storm' || this.weather.crewCondition.dust >= .6; },
  };
  game.crew = {
    g: game, visible: false, localPlayer: () => game.pos,
    bots: () => [{ x: 1, z: 0, visible: game.near }],
    blocked() { return CrewSession.prototype.blocked.call(this); },
  };
  return game;
}
const state = game => JSON.stringify({ opening: game.opening, weather: game.weather, resources: game.resources, saves: game.saves });
for (const text of rejected) {
  const game = fixture(), before = state(game);
  assert.equal(executeVesperCommand(game, text), null);
  assert.equal(state(game), before); assert.equal(game.advances, 0, 'unrecognised speech is not an action');
}
const game = fixture(), resources = JSON.stringify(game.resources);
for (const [text, mode, saves] of [['crew follow me', 'follow', 1], ['crew hold position', 'park', 2], ['crew resume excavation', 'work', 3]]) {
  const result = executeVesperCommand(game, text);
  assert.equal(result.ok, true); assert.equal(result.command, mode); assert.equal(game.opening.fleetMode, mode);
  assert.equal(game.saves, saves); assert.equal(game.crew.visible, false, 'voice does not require a crew menu');
  const repeat = state(game); assert.equal(executeVesperCommand(game, text).ok, true); assert.equal(state(game), repeat, 'same command grants and saves nothing again');
}
assert.equal(game.opening.followed, true); assert.equal(game.opening.worked, true);
assert.equal(JSON.stringify(game.resources), resources, 'commands never grant inventory, power or spoil');
for (const edit of [g => { g.pos.x = 19; }, g => { g.pos.x = 6; }, g => { g.near = false; },
  g => { g.paused = true; }, g => { g.driving = true; }, g => { g.habitat = { active: true }; },
  g => { g.chatBar.style.display = 'block'; }, g => { g.weatherSession.visible = true; }, g => { g.droneCount = 0; }]) {
  const blocked = fixture(); edit(blocked); const before = state(blocked);
  assert.equal(executeVesperCommand(blocked, 'crew follow me').ok, false);
  assert.equal(state(blocked), before, 'existing position/activity guards prevent voice bypass');
}
for (const [edit, reason] of [[g => { g.weather.crewSecured = true; }, /Release/],
  [g => { g.weatherNow.phase = 'storm'; }, /storm/], [g => { g.weather.crewCondition.dust = .7; }, /Clean/]]) {
  const held = fixture(); edit(held); const before = state(held), result = executeVesperCommand(held, 'crew resume excavation');
  assert.equal(result.ok, false); assert.match(result.message, reason); assert.equal(state(held), before);
}
const edge = fixture(); edge.advanceWeatherNow = function () { this.advances++; this.weatherNow.phase = 'storm'; };
assert.equal(executeVesperCommand(edge, 'crew follow me').ok, false, 'weather advances before permitting movement');
assert.equal(edge.opening.followed, false);
for (const edit of [g => { g.pos.x = 40; }, g => { g.paused = true; }, g => { g.driving = true; },
  g => { g.under = { active: true }; }, g => { g.droneCount = 0; }, g => { g.crew.visible = true; }]) {
  const blocked = fixture(); edit(blocked); const before = state(blocked);
  assert.equal(executeVesperCommand(blocked, 'recall the crew').ok, false); assert.equal(state(blocked), before);
}
for (const shelter of ['habitat', 'lander']) {
  const sheltered = fixture(); sheltered.pos.x = 100;
  if (shelter === 'habitat') sheltered.habitat = { active: true }; else sheltered.inLander = true;
  assert.equal(executeVesperCommand(sheltered, 'recall the crew').ok, true); assert.equal(sheltered.weather.crewSecured, true);
  assert.equal(sheltered.advances, 1); assert.equal(sheltered.saves, 1);
  assert.equal(executeVesperCommand(sheltered, 'recall the crew').ok, true); assert.equal(sheltered.saves, 1);
  assert.equal(executeVesperCommand(sheltered, 'release the crew').ok, true); assert.equal(sheltered.weather.crewSecured, false);
  assert.equal(sheltered.saves, 2); assert.equal(sheltered.opening.fleetMode, 'park', 'release does not invent a different crew mode');
  sheltered.weatherSheltered = () => false;
  assert.equal(executeVesperCommand(sheltered, 'recall the crew').ok, false, 'an unsealed room does not confer sheltered command access');
}
const dusty = fixture(); dusty.weather.crewSecured = true; dusty.weather.crewCondition.dust = .7;
assert.match(executeVesperCommand(dusty, 'release the crew').message, /Clean/);
const legacy = fixture(); legacy.opening = null;
assert.equal(executeVesperCommand(legacy, 'crew follow me').ok, false); assert.equal(legacy.opening, null);
assert.equal(executeVesperCommand(legacy, 'recall the crew').ok, true, 'legacy retains weather crew controls');
console.log('VESPER commands: strict utterances, negation/question/quote rejection, actual crew/weather guards, idempotence and resource conservation pass');

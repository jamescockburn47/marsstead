// An explicit command grammar for player input. Neither model replies nor
// extracted fragments are commands; the entire utterance must match one form.
import { commandCrew } from './crew-control.js';
import { weatherCrewCommandAllowed } from './weather-session.js';

const CREW = '(?:the )?(?:crew|workers|bots|drones)';
const ORDERS = [
  ['follow', 'follow me'],
  ['park', 'hold position'],
  ['work', 'resume excavation'],
];
const FORMS = ORDERS.map(([command, action]) => [command, new RegExp(
  `^(?:${CREW} ${action}|(?:ask|tell|order) ${CREW} to ${action}|have ${CREW} ${action})$`)]);
FORMS.push(['recall', new RegExp(`^recall ${CREW}$`)], ['release', new RegExp(`^release ${CREW}$`)]);

export function parseVesperCommand(text) {
  if (typeof text !== 'string' || text.length > 200 || /["'`“”‘’\r\n]/u.test(text)) return null;
  let value = text.trim().toLowerCase().replace(/\s+/g, ' ');
  value = value.replace(/^vesper(?:[, :]\s*|\s+)/, '');
  const politeRequest = /^(?:can|could|would) you /.test(value);
  if (value.endsWith('?') && !politeRequest) return null;
  value = value.replace(/[.!?]$/, '').replace(/^(?:can|could|would) you /, '').replace(/^please /, '');
  for (const [command, pattern] of FORMS) if (pattern.test(value)) return command;
  return null;
}

function heldMessage(game) {
  if (game.weather?.crewSecured) return 'The crew is sheltered at its dock. Release the crew through Weather first.';
  if (game.weatherNow?.phase === 'storm') return 'The crew is held during the storm. Wait in shelter until it passes.';
  return 'The crew is clogged with dust. Clean the workers through Weather before giving movement or excavation commands.';
}

// Submit after closing the chat input. Preserve the existing panel, position,
// shelter and weather guards; voice is another input to the same game actions.
export function executeVesperCommand(game, text) {
  const command = parseVesperCommand(text);
  if (!command) return null;
  const result = (ok, message) => ({ ok, command, message });
  if (!(game.droneCount > 0)) return result(false, 'No deployed workers are available for this command.');
  if (command === 'recall' || command === 'release') {
    if (!game.weather || !weatherCrewCommandAllowed(game)) {
      return result(false, 'Recall or release the crew from a sealed home, the lander, or beside the home entrance with other panels closed.');
    }
    game.advanceWeatherNow();
    if (!weatherCrewCommandAllowed(game)) return result(false, 'Crew command unavailable in the current location or activity.');
    const secured = command === 'recall', changed = game.weather.crewSecured !== secured;
    game.weather.crewSecured = secured;
    game.clearInput();
    if (changed) game.persist();
    if (secured) return result(true, 'Crew recalled to the sheltered dock. Excavation paused.');
    if (game.weatherNow?.phase === 'storm') return result(true, 'Crew released from shelter control. The storm still holds excavation until it passes.');
    if (game.weather.crewCondition?.dust >= .6) return result(true, 'Crew released from shelter control. Clean the dust-clogged workers through Weather before they can work.');
    return result(true, 'Crew released from the sheltered dock. Its previous crew mode is retained.');
  }
  if (!game.crew || !game.opening) return result(false, 'Local follow, hold and excavation commands are available for crews with local controls. Use Weather to recall or release this crew.');
  game.advanceWeatherNow();
  if (game.weatherCrewHeld?.()) return result(false, heldMessage(game));
  const before = [game.opening.fleetMode, game.opening.followed, game.opening.worked].join('/');
  if (!commandCrew(game.opening, command, { player: game.crew.localPlayer(), bots: game.crew.bots(), blocked: game.crew.blocked() })) {
    return result(false, 'Move within reach of a worker near home, on foot with other panels closed, to give this command.');
  }
  game.clearInput();
  if (before !== [game.opening.fleetMode, game.opening.followed, game.opening.worked].join('/')) game.persist();
  return result(true, command === 'follow' ? 'Crew following nearby. Excavation paused.'
    : command === 'park' ? 'Crew holding position. Excavation paused.' : 'Crew returning to excavation. Work resumes when power is available.');
}

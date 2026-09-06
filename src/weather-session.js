import { WEATHER_CSS } from './weather-style.js';

const REACH = 4, CLEAN_SECONDS = 4;
const distance = (g, target) => Math.hypot(g.pos.x - target.x, g.pos.z - target.z);
const moving = g => (g.vel?.length?.() ?? 0) > .15 || !!g.touchStick
  || ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].some(key => g.keys?.[key]);
function onSurface(g) {
  return !g.habitat?.active && !g.under?.active && !g.inLander && !g.driving && !g.hopFlight
    && !g.insidePressurised && !g.airborne && !g.sleepAnim && !g.cycling && !g.buildMode;
}
function otherPanel(g) {
  return !!(g.paused || g.attract || g.map?.visible || g.journalUI?.visible || g.orders?.visible
    || g.crew?.visible || g.fieldUI?.visible || g.burrowUI?.visible || g.worksUI?.visible
    || g.hopUI?.visible || g.under?.ui?.visible || g.chatBar?.style?.display === 'block');
}
export function weatherMaintenanceAllowed(g, target) {
  return !!target?.condition && onSurface(g) && !otherPanel(g) && !moving(g)
    && Number.isFinite(target.x) && Number.isFinite(target.z) && distance(g, target) <= REACH;
}
export function weatherCrewCommandAllowed(g) {
  if (otherPanel(g) || g.driving || g.hopFlight || g.under?.active || g.sleepAnim || g.cycling) return false;
  return !!((g.inLander || g.habitat?.active) && g.weatherSheltered()
    || onSurface(g) && g.distToCrown() <= 7);
}
function duration(seconds) {
  if (!Number.isFinite(seconds)) return 'awaiting forecast';
  const value = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}
function forecast(now) {
  if (now.phase === 'storm') return `Dust storm · ${duration(now.secondsRemaining)} remaining`;
  return `${now.phase === 'warning' ? 'Storm approaching' : 'Clear'} · storm in ${duration(now.secondsToStorm)}`;
}
function button(text, action) {
  const node = document.createElement('button'); node.type = 'button'; node.textContent = text;
  node.onclick = action; return node;
}

export class WeatherSession {
  constructor(game) {
    this.g = game; this.visible = false; this.cleaning = null; this.rows = new Map();
    const style = document.createElement('style'); style.textContent = WEATHER_CSS; document.head.append(style);
    this.prompt = button('Weather · awaiting forecast', () => this.open());
    this.prompt.id = 'weather-forecast'; this.prompt.hidden = true;
    this.prompt.setAttribute('aria-haspopup', 'dialog');
    this.root = document.createElement('section'); this.root.id = 'weather-console'; this.root.hidden = true;
    this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-labelledby', 'weather-heading');
    this.root.innerHTML = '<div class="weather-card"><header><h2 id="weather-heading">Weather and equipment</h2></header>'
      + '<p class="weather-report"></p><p class="weather-shelter"></p><p class="weather-rules">'
      + 'Covers keep dust out. Uncover to resume work; batteries stay connected. '
      + 'Cold slows exposed machinery. Wipe clogged equipment after the storm.</p>'
      + '<p class="weather-count"></p><div class="weather-crew"><b>Worker crew</b><p></p></div>'
      + '<p class="weather-maintenance">Stand within 4 m outdoors. '
      + 'Cleaning takes 4 seconds; wait for clear weather.</p>'
      + '<ul class="weather-equipment"></ul><p class="weather-action-status" role="status" aria-live="polite"></p></div>';
    this.closeButton = button('Close · Esc', () => this.close()); this.root.querySelector('header').append(this.closeButton);
    this.recall = button('Recall crew', () => this.commandCrew(true));
    this.release = button('Release crew', () => this.commandCrew(false));
    this.root.querySelector('.weather-crew').append(this.recall, this.release);
    this.root.addEventListener('keydown', event => {
      if (event.code === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); return; }
      if (event.code === 'Tab') {
        const controls = [...this.root.querySelectorAll('button:not(:disabled)')];
        if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
      } else event.stopPropagation();
    });
    this.root.addEventListener('keyup', event => event.stopPropagation());
    document.body.append(this.prompt, this.root);
  }
  open() {
    if (!this.g.weather || !this.g.weatherNow || otherPanel(this.g)) return false;
    this.visible = true; this.root.hidden = false; this.prompt.hidden = true; this.g.clearInput();
    this.message = ''; this.draw(); this.closeButton.focus(); return true;
  }
  close(focus = true) {
    if (!this.visible) return;
    this.cancelCleaning('Cleaning cancelled.'); this.visible = false; this.root.hidden = true;
    this.g.clearInput(); if (focus) this.g.focusWorld();
  }
  cancelCleaning(message) {
    if (!this.cleaning) return;
    this.cleaning = null; this.message = message;
  }
  targets() { return this.g.weatherTargets(); }
  act(id, action) {
    const g = this.g;
    g.advanceWeatherNow();
    const target = this.targets().find(item => item.id === id);
    if (!this.visible || !weatherMaintenanceAllowed(g, target)) {
      this.message = 'Stand still beside this equipment outdoors to maintain it.'; this.draw(); return false;
    }
    if (this.cleaning) { this.message = 'Finish or cancel the current cleaning task first.'; this.draw(); return false; }
    if (action === 'clean') {
      if (g.weatherNow.phase === 'storm' || target.condition.dust <= 0) return false;
      this.cleaning = { id, condition: target.condition, elapsed: 0, x: g.pos.x, z: g.pos.z, label: target.label };
      this.message = `Cleaning ${target.label}…`; this.draw(); return true;
    }
    if (!['secure', 'uncover'].includes(action) || target.kind === 'crew') return false;
    target.condition.secured = action === 'secure';
    this.message = `${target.label} ${action === 'secure' ? 'secured' : 'uncovered'}.`;
    g.persist(); this.draw(); return true;
  }
  commandCrew(secured) {
    const g = this.g;
    g.advanceWeatherNow();
    if (!this.visible || !weatherCrewCommandAllowed(g) || !g.weather || !(g.droneCount > 0)) return false;
    g.weather.crewSecured = !!secured;
    this.message = secured ? 'Crew recalled to the sheltered dock. Excavation paused.' : 'Crew released from the sheltered dock.';
    g.persist(); this.draw(); return true;
  }
  update(dt) {
    const g = this.g;
    if (this.visible && otherPanel(g)) this.close(false);
    if (this.cleaning) {
      const task = this.cleaning, target = this.targets().find(item => item.id === task.id);
      if (!this.visible || !weatherMaintenanceAllowed(g, target) || target.condition !== task.condition
        || g.weatherNow.phase === 'storm' || Math.hypot(g.pos.x - task.x, g.pos.z - task.z) > .15) {
        this.cancelCleaning('Cleaning cancelled. Return when it is safe and stand beside the equipment.');
      } else {
        task.elapsed += Number.isFinite(dt) ? Math.max(0, Math.min(.1, dt)) : 0;
        if (task.elapsed >= CLEAN_SECONDS) {
          g.advanceWeatherNow();
          if (g.weatherNow.phase === 'storm') {
            this.cancelCleaning('Cleaning cancelled as the storm arrived. Find shelter.');
            this.draw(); return;
          }
          target.condition.dust = 0; this.cleaning = null;
          this.message = `${target.label} cleaned.`; g.persist();
        }
      }
    }
    this.prompt.hidden = this.visible || !g.weatherNow || otherPanel(g) || !!g.sleepAnim;
    if (g.weatherNow) {
      const exposed = !g.weatherSheltered(), dangerous = g.weatherNow.cold || g.weatherNow.phase === 'storm';
      const cold = g.weatherNow.cold ? 'Cold night · ' : '';
      const warmth = exposed && dangerous ? ` · warmth ${Math.round(g.warm * 100)}%` : '';
      const clogged = this.targets().filter(target => target.condition.dust >= .6).length;
      const action = dangerous ? exposed ? ' · enter shelter' : ' · sheltered' : clogged ? ` · ${clogged} need cleaning` : '';
      this.prompt.textContent = `Weather · ${cold}${forecast(g.weatherNow)}${warmth}${action}`;
      this.prompt.dataset.phase = g.weatherNow.phase;
      this.prompt.dataset.cold = String(!!g.weatherNow.cold);
      this.prompt.title = g.weatherSheltered() ? 'Sheltered. Inspect forecast and equipment.' : 'Prepare equipment and find sealed shelter before the storm.';
      if (!g.attract && !g.paused) {
        let alert = '';
        if (g.weatherNow.phase !== this.lastPhase && g.weatherNow.phase === 'warning') {
          alert = `Dust storm in ${duration(g.weatherNow.secondsToStorm)}. Secure equipment, recall crew, then enter a sealed home or the lander.`;
        } else if (g.weatherNow.phase !== this.lastPhase && g.weatherNow.phase === 'storm') {
          alert = `Dust storm: ${duration(g.weatherNow.secondsRemaining)} remaining. ${exposed ? 'Enter a sealed home or the lander now.' : 'Stay in shelter until it passes.'}`;
        } else if (dangerous && exposed && this.lastExposed === false) {
          alert = 'Exposed: return to a sealed home or the lander. Your warmth is falling.';
        } else if (g.weatherNow.phase === 'clear' && this.lastPhase === 'storm') {
          alert = 'Storm passed. Uncover protected equipment and wipe clogged machinery to resume work.';
        } else if (g.weatherNow.cold && !this.lastCold) {
          alert = `Cold night. ${exposed ? 'Warmth is falling: enter a sealed home or the lander.' : 'Your current shelter protects you.'}`;
        }
        if (alert) {
          const event = g.weatherNow.phase === 'storm' ? 'weather-storm' : g.weatherNow.cold ? 'weather-cold' : 'weather-notice';
          if (g.dialogue) g.dialogue.instrument(event, alert); else g.hud?.say(alert, g.t, 9);
        }
        this.lastPhase = g.weatherNow.phase; this.lastCold = !!g.weatherNow.cold; this.lastExposed = exposed;
      }
    }
    if (this.visible) { g.clearInput(); this.draw(); }
  }
  makeRow(target) {
    const row = document.createElement('li');
    const title = document.createElement('b'), status = document.createElement('p'), actions = document.createElement('div');
    const cover = button('Secure', () => this.act(target.id, cover.dataset.action));
    const clean = button('Clean · 4 sec', () => this.act(target.id, 'clean'));
    cover.dataset.weatherTarget = String(target.id); clean.dataset.weatherTarget = String(target.id);
    clean.dataset.action = 'clean'; actions.append(cover, clean); row.append(title, status, actions);
    this.root.querySelector('.weather-equipment').append(row);
    const refs = { row, title, status, cover, clean }; this.rows.set(target.id, refs); return refs;
  }
  draw() {
    if (!this.visible) return;
    const g = this.g, now = g.weatherNow, targets = this.targets(), sheltered = g.weatherSheltered();
    this.root.querySelector('.weather-report').textContent = `${forecast(now)}. ${now.cold ? 'Cold night: cover idle equipment.' : 'Daytime conditions.'} Sleep advances the forecast.`;
    this.root.querySelector('.weather-shelter').textContent = sheltered
      ? 'Sheltered: your current sealed space protects you. Wait here until the storm passes.'
      : now.phase === 'storm' || now.cold ? `Exposed to ${now.phase === 'storm' ? 'the storm' : 'the cold night'}: warmth ${Math.round(g.warm * 100)}%. Return to a sealed home or the lander now.`
        : 'Outside shelter: secure equipment, recall the crew, then enter your sealed home or the lander before the storm.';
    this.root.querySelector('.weather-shelter').dataset.danger = String(!sheltered && (now.phase === 'storm' || now.cold));
    this.root.querySelector('.weather-count').textContent = `${targets.filter(item => item.condition.secured).length} / ${targets.length} equipment secured`;
    const crew = g.droneCount, crewAllowed = weatherCrewCommandAllowed(g) && crew > 0;
    this.root.querySelector('.weather-crew p').textContent = `${crew} workers · ${g.weather.crewSecured ? 'sheltered at dock' : 'released'}. Control from home, the lander or beside the home entrance.`;
    this.recall.disabled = !crewAllowed || g.weather.crewSecured; this.release.disabled = !crewAllowed || !g.weather.crewSecured;
    for (const [id, refs] of this.rows) if (!targets.some(target => target.id === id)) { refs.row.remove(); this.rows.delete(id); }
    for (const target of targets) {
      const refs = this.rows.get(target.id) || this.makeRow(target), condition = target.condition;
      const metres = distance(g, target), local = onSurface(g), allowed = weatherMaintenanceAllowed(g, target) && !this.cleaning;
      refs.title.textContent = target.label;
      const state = target.type === 'battery' ? `${condition.secured ? 'protected' : 'uncovered'} · bank connected`
        : condition.secured ? target.kind === 'crew' ? 'sheltered at dock' : 'secured · paused' : condition.dust >= .6
        ? target.kind === 'rover' ? 'dusty · reduced speed' : 'clogged · clean to restart' : 'uncovered';
      refs.status.textContent = `${state} · ${Math.round(condition.dust * 100)}% dust · ${local ? `${Math.round(metres)} m away` : 'outside; exit to maintain'}`;
      if (target.kind === 'crew') refs.status.textContent += ' · use Recall / Release crew at the home or lander';
      refs.cover.textContent = condition.secured ? 'Uncover' : 'Secure'; refs.cover.dataset.action = condition.secured ? 'uncover' : 'secure';
      refs.cover.hidden = target.kind === 'crew';
      refs.cover.setAttribute('aria-label', `${refs.cover.textContent} ${target.label}`);
      refs.clean.setAttribute('aria-label', `Clean ${target.label} · 4 seconds`);
      refs.cover.disabled = !allowed; refs.clean.disabled = !allowed || now.phase === 'storm' || condition.dust <= 0;
    }
    const status = this.root.querySelector('.weather-action-status');
    // Announce whole seconds, without replacing buttons or stealing keyboard focus each frame.
    const text = this.cleaning ? `Cleaning ${this.cleaning.label} · ${Math.ceil(CLEAN_SECONDS - this.cleaning.elapsed)} seconds remaining. Close to cancel.` : this.message;
    if (status.textContent !== text) status.textContent = text || '';
  }
}

// An explicit playtest note, kept in this panel until the player presses Send.
const PROMPTS = ['Something was fun', 'I got stuck', 'An idea'];
const CSS = `
#playtest-feedback{position:fixed;inset:0;z-index:110;background:#080c0ee6;display:flex;
 align-items:center;justify-content:center;padding:16px;box-sizing:border-box;color:#f4ecdf;
 font:calc(15px * var(--mars-text-scale,1))/1.5 Arial,Helvetica,sans-serif}
#playtest-feedback[hidden]{display:none}
#playtest-feedback section{width:min(580px,100%);max-height:calc(100dvh - 32px);overflow:auto;
 box-sizing:border-box;background:#191e1d;border:1px solid #91ac9e;border-radius:12px;padding:22px}
#playtest-feedback h2{font:26px Georgia,serif;color:#efd397;margin:0}
#playtest-feedback p{margin:10px 0}#playtest-feedback small{display:block;color:#c6cec7}
#playtest-feedback .feedback-options,#playtest-feedback .feedback-actions{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
#playtest-feedback button{font:inherit;min-height:44px;padding:9px 13px;color:inherit;background:#293b35;
 border:1px solid #87a494;border-radius:6px;cursor:pointer}
#playtest-feedback button[aria-pressed=true]{background:#386d60;border-color:#b2f2db}
#playtest-feedback button:disabled{opacity:.55;cursor:default}
#playtest-feedback textarea{display:block;width:100%;box-sizing:border-box;min-height:130px;resize:vertical;
 color:#fff5e4;background:#0d1617;border:1px solid #91ac9e;border-radius:6px;padding:11px;font:inherit;font-size:max(16px,1em)}
#playtest-feedback :focus-visible{outline:3px solid #b2f2db;outline-offset:3px}
#feedback-status{min-height:1.5em;color:#b2f2db}
@media(max-width:600px){#playtest-feedback section{padding:16px}}
`;
const finite = value => Number.isFinite(value) ? value : null;
function context(game) {
  const version = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
  const elapsed = finite(game.simMillis) !== null && finite(game.missionStart) !== null
    ? game.simMillis - game.missionStart : null;
  return {
    page: `playtest ${version}`.slice(0, 24),
    loc: game.habitat?.active ? 'habitat' : game.under?.active ? 'workings'
      : game.inLander ? 'lander' : game.insidePressurised ? 'inside' : game.driving ? 'rover' : 'surface',
    sol: elapsed === null ? null : Math.max(1, Math.floor(elapsed / 88775244) + 1),
    depth: game.habitat?.active ? finite(game.habitat.depth * 3)
      : game.under?.active ? finite(12 + game.under.pos?.z * .08) : 0,
    o2: finite(game.air) === null ? null : Math.round(Math.max(0, Math.min(1, game.air)) * 100),
  };
}

export class PlaytestFeedback {
  constructor(game) {
    this.g = game; this.pending = false; this.choice = 0;
    this.style = document.createElement('style'); this.style.textContent = CSS;
    document.head.append(this.style);
    this.root = document.createElement('div'); this.root.id = 'playtest-feedback'; this.root.hidden = true;
    this.root.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="feedback-heading">
      <h2 id="feedback-heading">How was Mars?</h2>
      <p>Send James a playtest note. What should we keep or improve?</p>
      <div class="feedback-options" role="group" aria-label="What is your note about?">${PROMPTS.map((p, i) =>
        `<button type="button" data-prompt="${i}" aria-pressed="${i === 0}">${p}</button>`).join('')}</div>
      <form><label for="feedback-message">Tell us what happened</label>
        <textarea id="feedback-message" minlength="8" maxlength="1960" required placeholder="A few words about your experience…"></textarea>
        <p><small>Please leave out names and personal details. Send shares this note, game version, location, sol, depth and oxygen with James. The server also records your network address.</small></p>
        <div class="feedback-actions"><button type="submit">Send</button><button type="button" data-feedback-close>Back to pause</button></div>
      </form><p id="feedback-status" role="status" aria-live="polite"></p>
    </section>`;
    this.input = this.root.querySelector('textarea');
    this.status = this.root.querySelector('[role=status]');
    this.sendButton = this.root.querySelector('[type=submit]');
    this.options = [...this.root.querySelectorAll('[data-prompt]')];
    for (const button of this.options) button.onclick = () => {
      if (this.pending) return;
      this.choice = Number(button.dataset.prompt);
      for (const option of this.options) option.setAttribute('aria-pressed', String(option === button));
    };
    this.root.querySelector('form').onsubmit = event => { event.preventDefault(); this.send(); };
    this.root.querySelector('[data-feedback-close]').onclick = () => this.close();
    for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'wheel', 'click', 'keyup'])
      this.root.addEventListener(type, event => event.stopPropagation());
    this.root.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); this.close(); }
      if (event.key === 'Tab') {
        const fields = [...this.root.querySelectorAll('button,textarea')].filter(el => !el.disabled);
        if (event.shiftKey && document.activeElement === fields[0]) { event.preventDefault(); fields.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === fields.at(-1)) { event.preventDefault(); fields[0].focus(); }
      }
    });
    document.body.append(this.root);
  }
  get visible() { return !this.root.hidden; }
  open() {
    if (this.visible) return;
    this.previousFocus = document.activeElement;
    this.g.voice?.cancelListening();
    this.g.experience.pause(true);
    this.sessionRoot = this.g.experience.session?.root;
    if (this.sessionRoot) { this.previousInert = this.sessionRoot.inert; this.sessionRoot.inert = true; }
    this.root.hidden = false;
    (this.pending ? this.root.querySelector('[data-feedback-close]') : this.input).focus();
  }
  close() {
    if (!this.visible) return;
    this.root.hidden = true;
    if (this.sessionRoot) this.sessionRoot.inert = this.previousInert;
    this.g.clearInput();
    const target = this.previousFocus?.closest('#session-overlay') ? this.previousFocus
      : this.sessionRoot?.querySelector('[data-action=resume]');
    target?.focus();
  }
  async send() {
    if (this.pending || !this.visible) return;
    const draft = this.input.value.trim();
    if (draft.length < 8 || draft.length > 1960) {
      this.status.textContent = 'Please write between 8 and 1,960 characters.'; this.input.focus(); return;
    }
    const payload = { kind: this.choice === 1 ? 'bug' : 'feedback',
      message: `${PROMPTS[this.choice]}: ${draft}`, context: context(this.g) };
    this.pending = true; this.input.disabled = true; this.sendButton.disabled = true;
    for (const button of this.options) button.disabled = true;
    this.status.textContent = 'Sending…';
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/dash/feedback', { method: 'POST', credentials: 'omit',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
      const result = response.ok ? await response.json() : null;
      if (result?.ok !== true) throw new Error('Feedback was not accepted');
      this.input.value = ''; this.status.textContent = 'Sent to James. Thank you!';
    } catch {
      this.status.textContent = 'Could not confirm delivery. Your note is still here. You can try Send again.';
    } finally {
      clearTimeout(timeout); this.pending = false; this.input.disabled = false; this.sendButton.disabled = false;
      for (const button of this.options) button.disabled = false;
    }
  }
}

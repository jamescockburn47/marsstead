import { BURROW_PIECES } from './burrow.js';
import { homeGrowth, homeView, escapeHomeText, roomDescription } from './home-model.js';
import { roomFurniture, roomShell } from './home-room.js';
import { droneClass } from './dronefleet.js';

const CELL = 112, SKY = 126;
export function renderHomeScene(b, selected, { droneCount = 3, selectedKey = '', reducedMotion = false, discovery = false } = {}) {
  const v = homeView(b, selected), growth = homeGrowth(b, droneCount);
  const width = (v.maxCol - v.minCol + 1) * CELL + 44;
  const height = SKY + v.maxDepth * CELL + 14;
  const X = c => 22 + (c - v.minCol) * CELL;
  const Y = d => SKY + (d - 1) * CELL;
  const cx = X(0) + 52;
  let svg = `<defs>
    <linearGradient id="home-sky" x2="0" y2="1"><stop stop-color="#322b30"/><stop offset=".55" stop-color="#896d5e"/><stop offset="1" stop-color="#c79b70"/></linearGradient>
    <linearGradient id="home-rock" x2="0" y2="1"><stop stop-color="#69503a"/><stop offset=".3" stop-color="#3c2c22"/><stop offset="1" stop-color="#1c1716"/></linearGradient>
    <linearGradient id="home-wall" x2="0" y2="1"><stop stop-color="#52616a"/><stop offset=".6" stop-color="#263b44"/><stop offset="1" stop-color="#182b33"/></linearGradient>
    <radialGradient id="home-roomglow" cx=".5" cy=".15" r=".85"><stop stop-color="#fff0c5" stop-opacity=".5"/><stop offset=".45" stop-color="#e8c58b" stop-opacity=".18"/><stop offset="1" stop-color="#e1b879" stop-opacity="0"/></radialGradient>
    <radialGradient id="home-haze"><stop stop-color="#dae0d8" stop-opacity=".45"/><stop offset="1" stop-color="#a0bfc7" stop-opacity="0"/></radialGradient>
    <clipPath id="home-rockclip"><rect y="${SKY}" width="${width}" height="${height-SKY}"/></clipPath>
    <filter id="home-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".15 .3" numOctaves="2" seed="8"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".045"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter>
  </defs><rect width="${width}" height="${height}" fill="#1c1716"/>
  <rect width="${width}" height="${SKY}" fill="url(#home-sky)"/>
  <ellipse cx="${width * .8}" cy="62" rx="140" ry="100" fill="url(#home-haze)"/>
  <path d="M0 112Q${width*.16} 73 ${width*.31} 104T${width*.65} 92T${width} 91V126H0Z" fill="#776352" opacity=".55"/>
  <path d="M0 123Q${width*.21} 93 ${width*.43} 117T${width} 108V131H0Z" fill="#846345"/>
  <g clip-path="url(#home-rockclip)"><rect y="${SKY}" width="${width}" height="${height-SKY}" fill="url(#home-rock)" filter="url(#home-grain)"/></g>
  <path d="M0 126H${width}" stroke="#d2ae7b" stroke-width="2" opacity=".5"/>`;
  for (let d = 1; d <= v.maxDepth; d++) {
    const y = Y(d) + 99;
    svg += `<path d="M0 ${y}Q${width*.3} ${y+13} ${width*.55} ${y-4}T${width} ${y+6}" fill="none" stroke="#c3a177" opacity=".08"/>
    <text x="8" y="${Y(d)+24}" fill="#c9b493" font-size="11" opacity=".75">${d*3}m</text>`;
  }
  // Surface head-frame: quiet engineered ivory against warm native rock.
  svg += `<path d="M${cx-47} 126L${cx-33} 96H${cx+33}L${cx+47} 126Z" fill="#866347" stroke="#c5ad86"/>
    <path d="M${cx-22} 97V86Q${cx} 56 ${cx+22} 86V97Z" fill="#c7c8be"/>
    <ellipse cx="${cx}" cy="98" rx="33" ry="8" fill="#58676c" stroke="${growth.sealed ? '#e5d49c' : '#9ba7a6'}" stroke-width="3"/>
    <path d="M${cx+52} 120V61" stroke="#b0b3ab" stroke-width="3"/>
    <circle cx="${cx+52}" cy="59" r="4" fill="#f5deb1"/>
    <text x="${cx}" y="30" text-anchor="middle" font-family="Georgia,serif" font-size="13" letter-spacing="3" fill="#f4e7cc">${growth.sealed ? 'YOUR HOME ON MARS' : 'THE FIRST GROUND'}</text>`;
  for (let i = 0; i < growth.drones; i++) {
    const dx = cx + (i % 2 ? 1 : -1) * (75 + Math.floor(i / 2) * 16);
    const flying = droneClass(i) === 'flying';
    const limbs = flying
      ? '<path d="M-16-2H16" stroke="#b8c6c1" stroke-width="2"/><ellipse cx="-14" cy="-3" rx="7" ry="2" fill="none" stroke="#dac9a4"/><ellipse cx="14" cy="-3" rx="7" ry="2" fill="none" stroke="#dac9a4"/>'
      : '<path d="M-5 0L-14 4L-17 12M0 1L-10 6L-11 12M5 0L14 4L17 12M3 1L10 6L11 12" fill="none" stroke="#b9a17d" stroke-width="2"/>';
    svg += `<g class="${flying ? 'home-drone' : 'home-spider'}" data-drone-class="${flying ? 'flying' : 'spider'}" style="animation-delay:${-i * .7}s" transform="translate(${dx} ${flying ? 96 : 113})"><title>${flying ? 'Flying survey and light-haul drone' : 'Spider excavation and fabrication worker'}</title>${limbs}<rect x="-8" y="-5" width="16" height="8" rx="3" fill="#d6dcd1"/><rect x="-4" y="-3" width="8" height="2" fill="#93e4d7"/></g>`;
  }
  // Connections behind rooms: the spaces are physically joined by pressure doors.
  for (const c of v.cells) {
    if (c.dug < 1) continue;
    const right = b.cells.get(`${c.col+1},${c.depth}`);
    if (right?.dug >= 1) svg += `<path d="M${X(c.col)+91} ${Y(c.depth)+63}h25" stroke="#a3b4b4" stroke-width="14"/><path d="M${X(c.col)+91} ${Y(c.depth)+63}h25" stroke="#3e555e" stroke-width="8"/>`;
    if (c.piece === 'shaft' && c.depth > 1) svg += `<path d="M${X(c.col)+48} ${Y(c.depth)-24}v48" stroke="#4b6066" stroke-width="20"/>`;
  }
  for (const cell of v.cells) {
    const x = X(cell.col), y = Y(cell.depth);
    const desc = roomDescription(b, cell.key);
    const label = escapeHomeText(`${desc.title}, ${desc.depth} metres. ${desc.state}. ${desc.detail}`);
    const cls = cell.dug >= 1 ? 'home-room' : cell.dug === 0 ? 'plan' : 'home-room';
    svg += `<g class="${cls}${selectedKey === cell.key ? ' inspected' : ''}" data-key="${cell.key}" data-c="${cell.col}" data-d="${cell.depth}" tabindex="0" role="button" aria-label="${label}" transform="translate(${x} ${y})"><title>${label}</title>`;
    if (cell.dug >= 1) {
      svg += roomShell(cell.piece, growth.sealed) + roomFurniture(cell.piece, { ...growth, discovery });
      svg += `<text x="53" y="106" text-anchor="middle" font-size="10" fill="#d7cfbc">${escapeHomeText(BURROW_PIECES[cell.piece].name)}</text>`;
    } else {
      const progress = Math.max(0, Math.min(1, cell.dug));
      svg += `<rect x="8" y="14" width="92" height="79" rx="7" fill="#252e2c" stroke="#ccad78" stroke-dasharray="5 4"/>
        <rect x="13" y="79" width="82" height="5" rx="2" fill="#5d4e37"/><rect x="13" y="79" width="${82*progress}" height="5" rx="2" fill="#93c8b4"/>
        <path d="M37 43L49 29H59L69 43V58H37Z" fill="#b9c9c1"/><rect class="home-pulse" x="45" y="43" width="16" height="4" fill="#79d8ca"/>
        <text x="54" y="70" text-anchor="middle" fill="#f1dfbb" font-size="10">${cell.waiting ? 'Needs charge' : progress > 0 ? `Digging ${Math.round(progress*100)}%` : 'Queued'}</text>`;
    }
    svg += '</g>';
  }
  for (const s of v.sockets) {
    const label = escapeHomeText(`Plan ${BURROW_PIECES[selected].name}, ${s.depth * 3} metres deep`);
    svg += `<g class="sock" data-key="${s.key}" data-c="${s.col}" data-d="${s.depth}" tabindex="0" role="button" aria-label="${label}" transform="translate(${X(s.col)} ${Y(s.depth)})"><title>${label}</title>
      <rect class="home-socket" x="8" y="14" width="92" height="79" rx="8" fill="#83dac7" fill-opacity=".055" stroke="#84c9ba" stroke-dasharray="4 5"/>
      <circle cx="54" cy="48" r="13" fill="#75cdb7" fill-opacity=".12" stroke="#85d8c4"/>
      <path d="M48 48h12M54 42v12" stroke="#b3f0d6" stroke-width="2"/>
      <text x="54" y="76" text-anchor="middle" fill="#c4dacc" font-size="10">${escapeHomeText(BURROW_PIECES[selected].name)}</text></g>`;
  }
  return { svg, width, height, reducedMotion, growth };
}

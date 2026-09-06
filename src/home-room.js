// Small dimensional room interiors. Geometry is SVG paths, never downloaded art.
import { HOME_ACCENTS } from './home-model.js';

const box = (x, y, w, h, fill = '#c3c4bc') => `<path d="M${x} ${y}l5 -4h${w}v${h}l-5 4Z" fill="#525e61"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${fill}"/><path d="M${x} ${y}l5 -4h${w}l-5 4Z" fill="#e4e0cc" opacity=".65"/>`;
const plant = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-6 0H6L4 9H-4Z" fill="#ba8a61"/><g class="home-leaf"><path d="M0 0V-22M0 -9Q-12 -8 -12 -19Q-1 -20 0 -9M0 -15Q11 -15 12 -26Q1 -26 0 -15" fill="#6cb697" stroke="#99d3ab" stroke-width="1.3"/></g></g>`;

export function roomFurniture(piece, { sealed = false, keepsake = false, discovery = false } = {}) {
  let s = '';
  if (piece === 'bunk') {
    s += '<ellipse cx="49" cy="82" rx="35" ry="6" fill="#0b1519" opacity=".6"/>';
    s += box(16, 65, 63, 10, '#8b7765');
    s += '<path d="M20 63l7 -10h52l-4 14H20Z" fill="#e9dfc6"/><path d="M40 54H79L75 67H40Z" fill="#749ea3"/><path d="M45 55v10M49 55v10" stroke="#b5d2c9" stroke-width="1.2"/><rect x="24" y="55" width="17" height="8" rx="4" fill="#fff2d7"/><path d="M18 75v7M74 75v7" stroke="#ae9b7b" stroke-width="3"/>';
    s += box(78, 59, 12, 19, '#a68f73');
    s += '<path d="M84 57V42" stroke="#b9b8a2" stroke-width="2"/><path d="M78 42H90L88 35H81Z" fill="#f1d6a5"/><ellipse cx="84" cy="57" rx="13" ry="14" fill="#ffe0a3" opacity=".1"/>';
    s += '<rect x="21" y="29" width="18" height="16" rx="2" fill="#b49d79"/><rect x="23" y="31" width="14" height="12" fill="#263d47"/><circle cx="30" cy="36" r="3" fill="#8cbac8"/>';
    if (keepsake) s += plant(54, 41, .42) + '<path d="M44 46H65" stroke="#d2b98c" stroke-width="2"/>';
    if (discovery) s += '<g class="home-specimen"><title>First Light · field survey complete</title><rect x="61" y="31" width="13" height="14" rx="2" fill="#acdad3" fill-opacity=".15" stroke="#b7d4c8" stroke-width=".7"/><path d="M64 41L66 35L70 33L72 41Z" fill="#87d2c1"/><path d="M66 35L70 33L69 41H66Z" fill="#d9bf89"/><path d="M60 46H75" stroke="#d5c09b" stroke-width="2"/></g>';
  } else if (piece === 'garden') {
    s += '<path d="M15 37H89M15 39V77M89 39V77" stroke="#a9bec0" stroke-width="2"/><rect x="18" y="35" width="68" height="3" rx="1" fill="#c3f4df"/>';
    s += '<path d="M18 39L8 76H96L86 39Z" fill="#a1e4cc" opacity=".06"/>';
    s += box(14, 73, 77, 11, '#738779');
    for (const [x, k] of [[24,.8],[43,1.05],[63,.9],[81,.7]]) s += plant(x, 70, k);
    s += '<path d="M18 87H87" stroke="#8fc1c0" stroke-width="1"/><circle class="home-pulse" cx="91" cy="43" r="2" fill="#b8efd5"/>';
  } else if (piece === 'store') {
    s += '<path d="M18 30V85M87 30V85M18 52H87M18 77H87" stroke="#96a9ad" stroke-width="2.5"/>';
    s += box(22, 38, 25, 13, '#aaa78f') + box(53, 36, 26, 15, '#7d9ca4');
    s += box(22, 61, 20, 15, '#a38b6e') + box(48, 59, 31, 17, '#b9bdaf');
    s += '<path d="M29 43h9M60 42h10M29 66h7M57 65h12" stroke="#e4ead9" stroke-width="2"/>';
    s += box(71, 79, 19, 9, '#809a97');
  } else if (piece === 'bay') {
    s += box(17, 67, 69, 7, '#a3b2b1');
    s += '<path d="M20 75v10M82 75v10" stroke="#879497" stroke-width="3"/><path d="M28 65V44L40 34L54 47" fill="none" stroke="#c8af88" stroke-width="5" stroke-linejoin="round"/><circle cx="40" cy="34" r="4" fill="#7a8b90"/>';
    s += box(54, 52, 26, 14, '#d0d4c8');
    s += '<rect x="59" y="56" width="14" height="4" rx="1" fill="#73dbd0"/><rect x="17" y="29" width="13" height="16" rx="2" fill="#24373e"/><path class="home-scan" d="M20 39h7" stroke="#8de1d5" stroke-width="2"/>';
  } else if (piece === 'shaft') {
    s += '<path d="M40 17V93M57 17V93" stroke="#9aacaf" stroke-width="2.5"/>';
    for (let y = 22; y < 92; y += 10) s += `<path d="M40 ${y}H57" stroke="#d0cfbb" stroke-width="2"/>`;
    s += '<path d="M75 17V91" stroke="#5a7d82" stroke-width="2"/><circle class="home-pulse" cx="75" cy="39" r="2" fill="#8adbd0"/>';
  } else {
    s += '<path d="M13 70H92" stroke="#7e989d" stroke-width="2"/><path d="M20 84H83" stroke="#d3c2a2" opacity=".7"/><rect x="70" y="40" width="13" height="8" rx="2" fill="#253e46"/><path d="M73 44h7" stroke="#9acfc6" stroke-width="1.5"/>';
  }
  return `<g class="home-furniture${sealed ? '' : ' unsealed'}">${s}</g>`;
}

export function roomShell(piece, sealed) {
  const accent = HOME_ACCENTS[piece] || HOME_ACCENTS.corridor;
  return `<path d="M5 19L17 10H100V82L88 93H5Z" fill="#a58b65"/>
    <path d="M5 19L17 10H100L95 15H20L10 22Z" fill="#dbc69e"/>
    <path d="M10 22L20 15H95V79L85 88H10Z" fill="url(#home-wall)"/>
    <path d="M10 22L20 15V79L10 88Z" fill="#414e51"/>
    <path d="M10 88L20 79H95L85 88Z" fill="#72817f"/>
    <path d="M20 79H95M34 81H88M31 85H83" fill="none" stroke="#c1beb0" opacity=".28" stroke-width=".8"/>
    <path d="M21 18H92M94 21V76M43 26V48M67 26V48" fill="none" stroke="#cbd4c9" opacity=".18" stroke-width=".6"/>
    <rect x="20" y="24" width="74" height="54" fill="url(#home-roomglow)" opacity="${sealed ? '1' : '.12'}"/>
    <rect x="27" y="20" width="46" height="2.5" rx="1" fill="${sealed ? '#e9f6e8' : '#b0b6ae'}"/>
    <path d="M27 23L12 75H88L73 23Z" fill="${accent}" opacity="${sealed ? '.08' : '.025'}"/>
    <path d="M7 93H88L100 82" fill="none" stroke="${accent}" stroke-width="2"/>
    <path d="M8 94H88L100 82V88L88 99H8Z" fill="#695945"/>
    <path d="M8 94H88L100 82" fill="none" stroke="#d5c09b" stroke-width="1"/>
    <g fill="#e0d1b1" opacity=".7"><circle cx="10" cy="27" r="1"/><circle cx="10" cy="82" r="1"/><circle cx="96" cy="22" r="1"/><circle cx="96" cy="75" r="1"/></g>`;
}

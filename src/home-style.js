export const HOME_CSS = `
#burrow { position:fixed; inset:0; z-index:55; display:none; background:#171515;
 color:#e9e5d9; font:calc(14px * var(--ui-scale,1))/1.5 system-ui,sans-serif; color-scheme:dark; }
#burrow.open { display:flex; flex-direction:column; }
#burrow * { box-sizing:border-box; }
#burrow header { display:flex; align-items:center; gap:16px; padding:16px 24px;
 border-bottom:1px solid #b7a07b35; background:linear-gradient(110deg,#352c24,#172128); }
#burrow h1 { margin:0; font:22px Georgia,serif; letter-spacing:4px; color:#eee0c5; }
#burrow header .sub { font-size:13px; color:#c1c8c6; }
#burrow .x { margin-left:auto; }
#burrow button { font:inherit; color:inherit; cursor:pointer; border:1px solid #8c9c9b66;
 border-radius:7px; background:#233037; padding:10px 13px; min-height:44px; }
#burrow button:hover { background:#35484c; }
#burrow button:focus-visible, #burrow [role=button]:focus-visible { outline:3px solid #b6eedb; outline-offset:3px; }
#burrow button:disabled { color:#a5aaa5; background:#242725; cursor:default; }
#bmain { display:grid; grid-template-columns:235px minmax(0,1fr); gap:16px;
 min-height:0; flex:1; padding:16px 24px 10px; }
#bside { display:flex; flex-direction:column; gap:12px; overflow:auto; min-height:0; }
.bpanel { flex-shrink:0; border:1px solid #b9ad8e32; border-radius:9px; padding:13px;
 background:linear-gradient(140deg,#34312b,#202729); }
.bpanel h2 { margin:0 0 9px; font:12px Georgia,serif; letter-spacing:2px; color:#ddcfb1; }
#bcards { display:grid; gap:6px; }
#burrow .bcard { text-align:left; display:flex; gap:9px; align-items:center; width:100%; padding:8px 10px; }
#burrow .bcard.sel { border-color:#9cd2be; background:#344b47; }
.bcard .glyph { width:26px; font-size:23px; color:#a5d2bf; text-align:center; }
.bcard b { display:block; font-size:14px; font-weight:500; }
.bcard small { display:block; color:#bfc5bb; font-size:12px; }
#bscene { overflow:auto; overscroll-behavior:contain; touch-action:pan-x pan-y;
 scrollbar-color:#8ca99c #282520; min-width:0; min-height:0; border:1px solid #b6a58455;
 background:#211b18; border-radius:12px; position:relative; }
#bscene svg { display:block; width:100%; height:auto; touch-action:pan-x pan-y;
 font-family:system-ui,sans-serif; }
#bscene .home-room, #bscene .sock, #bscene .plan { cursor:pointer; }
#bscene .home-room:hover, #bscene .home-room.inspected { filter:brightness(1.18); }
#bscene .sock:hover .home-socket, #bscene .sock:focus .home-socket { fill-opacity:.2; stroke-width:2.5; }
#binspect { min-height:95px; }
#binspect b { color:#f1e0bb; font-weight:500; }
#binspect p { margin:6px 0 0; color:#c8d1cc; font-size:13px; }
#binspect .state { color:#97d3bd; font-size:12px; }
#bvesper { font:italic 14px/1.5 Georgia,serif; color:#d0d7cd; }
#bstats { margin-top:9px; color:#c6cbc0; font-size:12px; }
.bmeter { margin:8px 0; }
.bmeter .ml { display:flex; justify-content:space-between; gap:5px; font-size:12px; }
.bmeter .mb { height:5px; background:#9eb4ac20; margin-top:4px; border-radius:3px; overflow:hidden; }
.bmeter i { display:block; height:100%; background:#d5bd8e; }
.bmeter.cool i { background:#91cbb9; }
#burrow footer { display:flex; align-items:center; flex-wrap:wrap; gap:9px; padding:10px 24px 16px; }
#burrow footer .hint { flex:1; min-width:180px; color:#c3bca8; font-size:12px; }
#burrow #bring:not(:disabled) { background:#ad956b; color:#141a1b; border-color:#e4c999; }
#burrow #bring.done { color:#a5dbc5; }
.home-leaf { transform-box:fill-box; transform-origin:bottom center; animation:home-leaf 6s ease-in-out infinite alternate; }
.home-pulse { animation:home-pulse 3s ease-in-out infinite alternate; }
.home-scan { animation:home-scan 4s ease-in-out infinite alternate; }
.home-drone > * { animation:home-float 3.5s ease-in-out infinite alternate; }
@keyframes home-leaf { from { transform:rotate(-3deg); } to { transform:rotate(4deg); } }
@keyframes home-pulse { from { opacity:.45; } to { opacity:1; } }
@keyframes home-scan { to { transform:translateY(-5px); } }
@keyframes home-float { to { transform:translateY(-3px); } }
@media (max-width:760px) {
 #burrow header { padding:10px 12px; } #burrow h1 { font-size:18px; letter-spacing:2px; }
 #burrow header .sub { display:none; }
 #bmain { grid-template-columns:1fr; grid-template-rows:auto minmax(240px,1fr); gap:9px; padding:10px 12px; }
 #bside { display:grid; grid-template-columns:1fr 1fr; max-height:220px; }
 #bside .bpanel { padding:9px; } #bside .report-panel,#bside .voice-panel { display:none; }
 #bcards { grid-template-columns:1fr 1fr; gap:4px; }
 #burrow .bcard { padding:6px; gap:4px; } .bcard .glyph { display:none; }
 .bcard b { font-size:12px; } .bcard small { font-size:11px; }
 #burrow footer { padding:8px 12px; gap:6px; } #burrow footer .hint { display:none; }
 #burrow footer button { flex:1; font-size:12px; padding:7px; }
 #bscene svg { min-width:720px; } #binspect p { font-size:12px; }
 #bscene::after { content:'Swipe across your home · tap a room to inspect'; display:block;
  position:sticky; left:0; bottom:0; width:100%; padding:7px 10px;
  font-size:11px; background:#1d2728ee; color:#d4dbca; pointer-events:none; }
}
@media (max-height:520px) and (min-width:761px) { #burrow header { padding:6px 20px; }
 #bmain { padding-top:6px; } #burrow footer { padding-bottom:6px; } }
@media (prefers-reduced-motion:reduce) { #burrow *, #burrow svg * { animation:none!important; transition:none!important; } }
#burrow.reduced-motion *, #burrow.reduced-motion svg * { animation:none!important; transition:none!important; }
`;

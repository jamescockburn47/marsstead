// One restrained instrument finish across the three playable environments.
// Controls, accessible names, text scaling and input routes remain unchanged.
export const INSTRUMENT_CSS = `
body #first-light,body #habitat-tools,body #habitat-activity,body #under-instruments{
 background:linear-gradient(135deg,#182225f2,#111a1deb);border:1px solid #61736b75;
 border-left:2px solid #9eb6a4;border-radius:3px;box-shadow:0 6px 24px #0003;
 color:#e5dfd1;letter-spacing:.01em}
body #first-light{padding:13px 15px;width:min(285px,calc(100vw - 40px))}
body #first-light .overline{font-size:9px;letter-spacing:2px;color:#b0c5b8}
body #first-light h2{font-size:calc(19px * var(--ui-scale,1))}body #first-light .bearing{margin-top:7px}
body #habitat-tools{max-width:520px;padding:11px 13px}
body #habitat-tools b,body #habitat-activity b{font-size:.85em;letter-spacing:.07em;color:#c7d6c8}
body #habitat-tools p{margin:6px 0 9px;color:#d0d5cd}
body #habitat-tools div{gap:5px}
body #habitat-tools button,body #habitat-activity button,body #under-instruments button{
 background:#263735;border:1px solid #6f837477;border-radius:3px;color:#e1e4d9;
 box-shadow:inset 0 1px #ffffff06;cursor:pointer}
body #habitat-tools [data-act=use],body #habitat-activity [data-act=use]{
 background:#3c4940;border-color:#a99b72;color:#fff0d0}
body #habitat-tools button:disabled{display:none}
body #habitat-tools button:hover,body #habitat-activity button:hover,body #under-instruments button:hover{background:#40504a}
body #habitat-tools button:focus-visible,body #habitat-activity button:focus-visible,body #under-instruments button:focus-visible{
 outline:2px solid #e1c389;outline-offset:3px}
body #under-instruments{padding:12px 14px}
@media(max-width:600px){body #first-light{width:calc(100vw - 24px);padding:10px 12px}
body #habitat-tools{padding:10px;max-height:34vh}body #habitat-tools button{min-height:42px;padding:8px}
body #habitat-tools p{font-size:calc(13px * var(--mars-text-scale,1))}body #under-instruments button{min-height:42px}}
`;

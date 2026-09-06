import {INSTRUMENT_CSS} from './instrument-style.js';
export const EXPERIENCE_CSS = `
 :root {--ui-scale:1;--mars-text-scale:1}
 #first-light {position:fixed;left:20px;top:88px;z-index:35;width:min(302px,calc(100vw - 40px));
 box-sizing:border-box;padding:16px 18px;background:linear-gradient(120deg,#132426ef,#1c2426db);
 border-left:2px solid #85cfc0;border-radius:0 6px 6px 0;color:#eee4d2;font:calc(14px * var(--ui-scale))/1.5 system-ui,sans-serif;box-shadow:0 8px 28px #0002}
 #first-light .overline {font-size:10px;letter-spacing:2.5px;color:#88cdbd;margin-bottom:8px}
 #first-light h2 {font:normal calc(20px * var(--ui-scale))/1.25 Georgia,serif;margin:0 0 8px}
 #first-light p {margin:0 0 8px;color:#d2dcd2}
 #first-light .reward {color:#b9c3b7;font-size:.87em}
 #first-light .bearing {display:flex;align-items:center;gap:10px;margin-top:12px;color:#efcc94}
 #first-light .arrow {display:inline-block;font-size:22px;transform-origin:center}
 #first-light button {font:inherit;color:#d4eee2;background:#92d6c11a;border:1px solid #a9c2a94d;border-radius:4px;padding:8px 12px;cursor:pointer;min-height:40px;margin-top:10px}
 #first-light button:focus-visible,#build-menu button:focus-visible{outline:2px solid #8adbc8;outline-offset:2px}
 #build-menu {position:fixed;left:20px;top:80px;z-index:36;background:#152126ed;border:1px solid #ae996d80;border-radius:6px;
 padding:16px;width:250px;max-height:65vh;overflow:auto;color:#eee4d2;box-sizing:border-box;font:calc(14px * var(--ui-scale))/1.5 system-ui,sans-serif}
 #build-menu h2 {font:20px Georgia,serif;margin:0 0 10px}#build-menu p{color:#c4d1c7;font-size:12px}
 #build-menu button {display:block;width:100%;text-align:left;color:inherit;background:#eee4d209;border:1px solid transparent;
 padding:9px;margin:5px 0;border-radius:3px;font:inherit;cursor:pointer;min-height:44px}
 #build-menu button[aria-pressed=true]{background:#98d5bf20;border-color:#8ecfb9;color:#b8f0d7}
 #build-menu button small{display:block;color:#bac1b5;font-size:11px}
 #hud .prompt{font-family:system-ui,sans-serif;font-size:calc(14px * var(--ui-scale));bottom:78px;
 width:auto;max-width:calc(100vw - 360px);left:50%;transform:translateX(-50%);padding:8px 12px;background:#102023cc;border-radius:4px;letter-spacing:0}
 #hud .vesper{font-size:calc(16px * var(--ui-scale));padding:0 200px;box-sizing:border-box}
 @media(min-width:901px){body.in-habitat #hud .vesper{bottom:calc(232px * var(--ui-scale));left:50%;transform:translateX(-50%);width:min(680px,calc(100vw - 48px));padding:10px 16px;background:#102023e6;border-radius:4px}}
 #hud .vitals{font-family:system-ui,sans-serif;font-size:calc(12px * var(--ui-scale));letter-spacing:1px}
 #hud .bags{top:126px;max-width:250px;font-family:system-ui,sans-serif}
 @media(max-width:900px){#hud .prompt{max-width:calc(100vw - 40px);bottom:94px}#hud .vesper{padding:0 18px;bottom:22px}
 #first-light{top:112px;width:260px;padding:12px 14px}#first-light p{font-size:13px}#first-light .reward{display:none}}
 @media(max-width:560px){#first-light{top:170px;left:12px;width:calc(100vw - 24px)}#first-light h2{font-size:17px}
 #first-light .overline{display:none}#first-light .bearing{display:inline-flex;height:44px;margin-top:0}
 #first-light button{float:right;margin-top:0}#first-light::after{content:'';display:block;clear:both}
 #hud .clock{font-size:11px;left:12px}#hud .clock .sub{max-width:170px;font-size:9px}
 #hud .vitals{right:12px;width:120px}#hud .bags{display:none}#build-menu{top:118px;left:12px;width:230px}
 html.touch #first-light{max-height:30vh;overflow:auto}html.touch #hud .prompt{bottom:210px}
 html:not(.touch) #hud .prompt{left:auto;right:12px;transform:none;max-width:170px;bottom:24px;font-size:12px}}
 @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
 ${INSTRUMENT_CSS}
`;

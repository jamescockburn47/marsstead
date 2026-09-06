export const CREW_CSS = `
#crew-console{box-sizing:border-box;position:fixed;inset:0;display:none;align-items:center;justify-content:center;padding:18px;z-index:58;background:#091014bb;color:#f2e9d8;font:calc(16px * var(--ui-scale,1))/1.5 system-ui}
#crew-console .crew-card{box-sizing:border-box;width:min(620px,100%);max-height:88vh;overflow:auto;border:1px solid #b29e79;border-radius:7px;background:#1d2c30;padding:24px}
#crew-console h2{font:26px Georgia,serif;margin:5px 0 12px}#crew-console p{color:#c6d4d0}#crew-console button,#crew-prompt{font:inherit;border:1px solid #8b9e93;background:#324a4b;color:#f2e9d8;padding:11px 15px;border-radius:4px;cursor:pointer;min-height:44px}
#crew-console button:focus-visible,#crew-prompt:focus-visible{outline:2px solid #f1d194;outline-offset:3px}#crew-console button:disabled{opacity:.45;cursor:default}#crew-console .crew-actions{display:flex;gap:9px;flex-wrap:wrap}#crew-console .crew-close{float:right}#crew-console [role=status]{min-height:3em;color:#d2c394}
#crew-prompt{position:fixed;right:24px;bottom:132px;z-index:26;max-width:min(330px,80vw);font:calc(14px * var(--ui-scale,1))/1.4 system-ui;text-align:left;background:#15292ce8}
html.touch #crew-prompt{z-index:42;left:12px;right:12px;bottom:250px;max-width:none}
html.touch:has(#crew-prompt:not([hidden])) #hud .prompt{display:none}
.crew-label{position:fixed;pointer-events:none;transform:translate(-50%,-100%);z-index:24;padding:3px 7px;border-radius:3px;background:#132327cc;color:#e8dcc2;font:calc(12px * var(--ui-scale,1))/1.3 system-ui;white-space:nowrap}
`;

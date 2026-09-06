export const WEATHER_CSS = `
#weather-forecast{position:fixed;right:18px;top:214px;z-index:52;max-width:285px;min-height:44px;padding:9px 12px;border:1px solid #829787;border-radius:4px;background:#15262beF;color:#e8e1d2;text-align:left;font:calc(13px * var(--mars-text-scale,1))/1.4 system-ui;cursor:pointer}
#weather-forecast[data-phase=warning],#weather-forecast[data-phase=storm],#weather-forecast[data-cold=true]{border-color:#d6aa67;color:#ffe1a7}
#weather-forecast[hidden],#weather-console[hidden]{display:none}
#weather-console{position:fixed;inset:0;z-index:59;display:flex;align-items:center;justify-content:center;padding:18px;background:#071015c9;color:#eee6d6;font:calc(15px * var(--mars-text-scale,1))/1.45 system-ui;box-sizing:border-box}
#weather-console *{box-sizing:border-box}
#weather-console .weather-card{width:min(760px,100%);max-height:92dvh;overflow:auto;overscroll-behavior:contain;padding:22px;border:1px solid #879585;border-radius:5px;background:#18272c}
#weather-console header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
#weather-console h2{font:25px/1.2 Georgia,serif;margin:4px 0 10px}
#weather-console p{margin:8px 0;color:#cbd5cd}
#weather-console .weather-report,#weather-console .weather-count{color:#f0d299}
#weather-console .weather-shelter{padding:10px 12px;border-left:3px solid #91bca0;background:#8dc3ab0c}
#weather-console .weather-shelter[data-danger=true]{border-color:#e4a66c;color:#ffe1bd}
#weather-console .weather-rules,#weather-console .weather-maintenance{font-size:.9em}
#weather-console .weather-crew{padding:12px 0;border-block:1px solid #65776a66}
#weather-console button{min-height:44px;padding:9px 13px;border:1px solid #718d7c;border-radius:4px;background:#304641;color:#eee6d6;font:inherit;cursor:pointer}
#weather-console button+button{margin-left:8px}
#weather-console button:disabled{opacity:.45;cursor:default}
#weather-console button:focus-visible,#weather-forecast:focus-visible{outline:2px solid #f3ce8c;outline-offset:3px}
#weather-console .weather-equipment{list-style:none;padding:0;margin:0}
#weather-console .weather-equipment li{padding:12px 0;border-bottom:1px solid #65776a55;overflow-wrap:anywhere}
#weather-console .weather-equipment li div{display:flex;flex-wrap:wrap;gap:8px}
#weather-console .weather-equipment li button+button{margin-left:0}
#weather-console .weather-action-status{position:sticky;bottom:-22px;padding:10px 0;margin-bottom:0;background:#18272c;color:#ffe0a0;min-height:42px}
@media(max-width:600px){
 #weather-forecast{top:auto;right:auto;left:10px;bottom:calc(env(safe-area-inset-bottom) + 8px);max-width:200px;font-size:12px;z-index:52;padding:7px 10px}
 #weather-console{padding:10px}#weather-console .weather-card{padding:15px;max-height:94dvh}
 #weather-console h2{font-size:21px}#weather-console header>button{flex-shrink:0;font-size:12px;padding:8px}
 #weather-console .weather-action-status{bottom:-15px}
}
`;

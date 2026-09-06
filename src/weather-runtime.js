// Game wiring stays separate from the deterministic forecast and exposure ledger.
import { acceptWeather, acceptCondition, weatherAt, advanceWeather, equipmentEfficiency } from './weather.js';
import { WeatherSession } from './weather-session.js';
import { WeatherLayer } from './weather-layer.js';
import { activeCrewCount, CREW_DOCK } from './crew-control.js';
import { MACHINE_TYPES } from './machines.js';
import { tauAt } from './dust.js';
import { mtc } from './marstime.js';

export function installWeather(g, save, groundAt) {
  g.weather = acceptWeather(save?.weather, g.simMillis);
  g.weatherEquipment = { rover: acceptCondition(save?.weatherEquipment?.rover), rig: acceptCondition(save?.weatherEquipment?.rig) };
  g.weatherTargets = () => {
    g.weather.crewCondition.secured = g.weather.crewSecured;
    const target = (id, label, body, condition, kind, type = null) =>
      ({ id, label, x: body.x, z: body.z, heading: body.heading || 0, condition, kind, type });
    return [
      ...g.machines.map((m, i) => {
        m.exposure ??= acceptCondition(null);
        return target(`machine-${i}`, MACHINE_TYPES[m.type].name, m, m.exposure, 'machine', m.type);
      }),
      target('rover', 'Open rover', g.buggy, g.weatherEquipment.rover, 'rover'),
      target('rig', 'Mining rig', g.rig, g.weatherEquipment.rig, 'rig'),
      target('crew', 'Worker crew dock', { x: g.crownPos.x + CREW_DOCK.x, z: g.crownPos.z + CREW_DOCK.z }, g.weather.crewCondition, 'crew'),
    ];
  };
  g.weatherSheltered = () => !!(g.inLander || g.insidePressurised || (g.habitat?.active && g.burrow.ringInstalled));
  g.weatherCrewHeld = () => g.weather.crewSecured || g.weatherNow?.phase === 'storm' || g.weather.crewCondition.dust >= .6;
  g.weatherCrewAvailable = () => g.weatherCrewHeld() ? 0 : activeCrewCount(g.opening, g.droneCount) * equipmentEfficiency(g.weather.crewCondition, g.sunEl ?? 10);
  g.weatherEfficiency = condition => equipmentEfficiency(condition, g.sunEl ?? 10);
  g.advanceWeatherNow = () => {
    advanceWeather(g.weather, g.simMillis, g.weatherTargets().map(target => target.condition));
    g.weatherNow = weatherAt(g.weather, g.simMillis, g.sunEl ?? 10);
  };
  g.currentTau = () => Math.max(tauAt(mtc(g.simMillis), Math.floor(g.simMillis / 88775244)),
    .4 + weatherAt(g.weather, g.simMillis, g.sunEl ?? 10).intensity * 4.2);
  g.weatherLayer = new WeatherLayer(g.scene);
  g.weatherSession = new WeatherSession(g);
  g.updateWeatherWorld = () => {
    g.advanceWeatherNow();
    g.weatherLayer.update(g.weatherTargets(), groundAt, g.t);
  };
  g.advanceWeatherNow();
}

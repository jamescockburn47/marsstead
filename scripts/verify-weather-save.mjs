import assert from 'node:assert/strict';
import { snapshotSave, acceptSave } from '../src/save.js';
import { createWeather, advanceWeather, equipmentEfficiency } from '../src/weather.js';
import { suitStep } from '../src/survival.js';
import { machineTick } from '../src/machines.js';
import { weatherMaintenanceAllowed, weatherCrewCommandAllowed } from '../src/weather-session.js';

const now = 1770000000000;
const state = { simMillis: now, pos: {x:0,z:0}, heading:0, air:1,warm:1,
  buggy:{x:14,z:6,heading:0},suit:{regolith:3},rover:{'solar-wing':1},lander:{},stead:[],
  exploration:[],saidFirsts:new Set(),rig:{x:-16,z:-1,heading:0,hopper:{}},prospected:new Set(),
  fab:{queue:[],t:0,out:{}},machines:[{type:'smelter',x:5,z:5,heading:0,queue:['iron-ore'],t:3,out:{glass:1},exposure:{secured:false,dust:0}}],
  weather:createWeather(now),weatherEquipment:{rover:{secured:true,dust:0},rig:{secured:false,dust:0}} };
state.simMillis += 1200 * 40000;
advanceWeather(state.weather,state.simMillis,[state.machines[0].exposure,state.weatherEquipment.rover,state.weatherEquipment.rig]);
const saved = snapshotSave(state), restored = acceptSave(JSON.parse(JSON.stringify(saved)));
assert.deepEqual(restored.weather, state.weather);
assert.deepEqual(restored.weatherEquipment, state.weatherEquipment);
assert.deepEqual(restored.machines[0].exposure,state.machines[0].exposure);
assert.equal(restored.machines[0].queue[0],'iron-ore');assert.equal(restored.machines[0].t,3);
assert.deepEqual(restored.suit,state.suit);assert.deepEqual(restored.rover,state.rover);
assert.equal(restored.machines[0].out.glass,1);
const dust = restored.machines[0].exposure.dust;
advanceWeather(restored.weather,restored.simMillis,[restored.machines[0].exposure]);
assert.equal(restored.machines[0].exposure.dust,dust,'reload must not charge again');
const legacy = {...saved};delete legacy.weather;delete legacy.weatherEquipment;
const migrated = acceptSave(legacy);
assert.equal(migrated.weather.epochMillis,migrated.simMillis,'legacy receives full warning grace');
assert.deepEqual(migrated.weatherEquipment.rover,{secured:false,dust:0});
const bad = acceptSave({...saved,weatherEquipment:{rover:{secured:'yes',dust:Infinity}},
  machines:[{...saved.machines[0],exposure:{secured:'false',dust:-99}}]});
assert.deepEqual(bad.weatherEquipment.rover,{secured:false,dust:0});
assert.deepEqual(bad.machines[0].exposure,{secured:false,dust:0});
const m=restored.machines[0];
const before=JSON.stringify({queue:m.queue,t:m.t,out:m.out});
if(equipmentEfficiency(m.exposure,20)>0)machineTick(m,1);
assert.equal(JSON.stringify({queue:m.queue,t:m.t,out:m.out}),before,'clogged queue remains intact');
const vitals = (temp,storm,sheltered=false) => suitStep({air:.8,warm:.8,temp,storm,sheltered},.1);
assert.ok(vitals(-84,0).warm<.8,'night imposes exposure');
assert.ok(vitals(-25,1).warm<.8,'daytime storm imposes exposure');
assert.ok(vitals(-84,1).warm<vitals(-84,0).warm,'night plus storm compounds');
assert.ok(vitals(-84,1,true).warm>.8,'sealed bunker restores even in storm');
assert.equal(suitStep({air:1,warm:0,temp:-84,storm:1},.1).rescue,true,'exhaustion triggers cargo-safe return');
const g={pos:{x:0,z:0},keys:{},vel:{length:()=>0},weatherSheltered:()=>true,distToCrown:()=>3};
const target={x:1,z:1,condition:{secured:false,dust:.7}};
assert.ok(weatherMaintenanceAllowed(g,target));
for(const field of ['driving','inLander','airborne','buildMode','paused'])assert.equal(weatherMaintenanceAllowed({...g,[field]:true},target),false,field);
for(const field of ['habitat','under'])assert.equal(weatherMaintenanceAllowed({...g,[field]:{active:true}},target),false,field);
assert.equal(weatherMaintenanceAllowed({...g,pos:{x:9,z:9}},target),false,'remote maintenance blocked');
assert.equal(weatherMaintenanceAllowed({...g,vel:{length:()=>1}},target),false,'moving maintenance blocked');
assert.ok(weatherCrewCommandAllowed({...g,habitat:{active:true}}),'real hub allows recall');
assert.equal(weatherCrewCommandAllowed({...g,driving:true}),false);
console.log('verify-weather-save: persistence, legacy grace, resources, real shelter and physical maintenance boundaries pass');

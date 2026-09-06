import {activityAction,tickHabitatActivities,bindActivityRooms} from './habitat-activities.js';
import {createRescueSite,createActivityProps,RESCUE_SITE} from './habitat-activity-layer.js';
import {WorkerSpider} from './workerspider.js';
import {freezeSimulation} from './survival.js';

const BENCH={carried:['bench','Place worker on bench'],bench:['diagnose','Run VESPER diagnostic'],diagnosed:['repair','Refit drive coupling'],repaired:['equip','Fit auger and pack worker']};
const CROP={empty:['plant','Plant tomato seed'],planted:['water','Water nursery pot'],ready:['harvest','Harvest and pack tomato']};
export class HabitatActivitySession {
  constructor(g,ground){
    this.g=g;this.site=createRescueSite(g.scene,ground);this.carry=new WorkerSpider({scale:.5,variant:'dig',seed:37});
    this.ui=document.createElement('aside');this.ui.id='habitat-activity';this.ui.hidden=true;
    this.ui.innerHTML='<b>Field service hatch</b><p></p><button data-act="use"></button><button data-act="eat"></button>';
    document.body.append(this.ui);const style=document.createElement('style');
    style.textContent='#habitat-activity{position:fixed;right:18px;bottom:170px;max-width:320px;z-index:48;background:#152323ec;border:1px solid #7b9586;border-radius:7px;padding:12px;color:#e6ddc6;font:14px/1.4 system-ui}#habitat-activity[hidden]{display:none}#habitat-activity p{margin:6px 0}#habitat-activity button{font:inherit;padding:8px;color:inherit;background:#38544b;border:1px solid #809488;border-radius:4px;margin:3px}#habitat-activity button[hidden]{display:none}@media(max-width:600px){#habitat-activity{right:10px;left:10px;bottom:auto;top:125px;max-width:none;font-size:12px}}';document.head.append(style);
    this.ui.onclick=e=>{const act=e.target.closest('button')?.dataset.act;if(act==='use')this.interactSurface();if(act==='eat')this.act('eat');g.focusWorld();};
  }
  blocked(){const g=this.g;return freezeSimulation(g)||g.burrowUI.visible||g.worksUI.visible||g.buildMode||!!g.sleepAnim||g.hopUI.visible;}
  nearby(target){const h=this.g.habitat;return !!target&&h.active&&h.room?.key===target.roomKey&&Math.hypot(h.pos.x-target.x,h.pos.z-target.z)<1.05;}
  context(){const g=this.g,field=!g.habitat.active&&!g.under.active&&!g.inLander&&!g.driving&&!g.hopFlight;
    return {paused:this.blocked(),sealed:!!g.burrow.ringInstalled,nearWorker:field&&Math.hypot(g.pos.x-RESCUE_SITE.x-2,g.pos.z-RESCUE_SITE.z-1)<3,
      nearHatch:field&&Math.hypot(g.pos.x-RESCUE_SITE.x,g.pos.z-RESCUE_SITE.z)<3,nearBench:this.nearby(this.props?.targets.bench),nearCrop:this.nearby(this.props?.targets.crop)};
  }
  act(action){const g=this.g,result=activityAction(g.activities,action,this.context());
    if(result.ok){
      if(action==='eat'){g.restedQ=Math.max(g.simMillis<(g.restedUntil||0)?g.restedQ||0:0,.35);g.restedUntil=Math.max(g.restedUntil||0,g.simMillis+3698968.5);result.message='Tomato ration eaten. Rested breathing bonus for one Mars hour.';}
      if(action==='diagnose')result.message='VESPER diagnostic: loose drive coupling located. Refit it at the bench.';
      g.persist();
    }
    this.message=result.message;if(g.habitat.active)g.habitat.message=result.message;else g.hud.say(result.message,g.t,6);
    this.refreshVisuals();return result;
  }
  roomAction(){const g=this.g,h=g.habitat;
    if(h.room?.piece==='bay'&&h.room.key===g.activities.benchRoom)return BENCH[g.activities.worker]||null;
    if(h.room?.piece==='garden'&&h.room.key===g.activities.cropRoom)return CROP[g.activities.crop.phase]||null;return null;
  }
  interactRoom(){const h=this.g.habitat;
    if(!['bay','garden'].includes(h.room?.piece))return false;
    const roomKey=this.g.activities[h.room.piece==='bay'?'benchRoom':'cropRoom'];
    if(h.room.key!==roomKey){h.message=`Your ${h.room.piece==='bay'?'repair bench':'nursery pot'} is in diagram cell ${roomKey}. This room remains available for ordinary habitat use.`;return true;}
    const action=this.roomAction();
    if(action)this.act(action[0]);
    else h.message=h.room.piece==='garden'?`Tomatoes growing: ${Math.floor(this.g.activities.crop.growth/60*100)}%. Explore while they grow.`:this.g.activities.worker==='stranded'?'A disabled worker is beside the First Light station. Recover it and bring it to this bench.':'The worker is packed or deployed. Take it to the field service hatch.';
    return true;
  }
  interactSurface(){const c=this.context(),s=this.g.activities;
    if(c.paused||(!c.nearWorker&&!c.nearHatch))return false;
    if(s.worker==='stranded'&&c.nearWorker){this.act('rescue');return true;}
    if(s.worker==='equipped'&&c.nearHatch){this.act('deploy');return true;}
    if(s.routeOpen&&c.nearHatch){this.g.under.requestEnter('field');return true;}
    this.g.hud.say(s.worker==='deployed'?'The repaired worker is clearing the hatch.':'Take the recovered worker to a sealed habitat workshop.',this.g.t,5);return true;
  }
  brief(){const s=this.g.activities;return `Habitat activities: rescued worker=${s.worker}; field entrance=${s.routeOpen?'open':'blocked'}; tomato=${s.crop.phase}; packed rations=${s.rations}. Workshop E near bench: place, diagnose using your local diagnostic arm, refit coupling, fit auger. Greenhouse E near nursery pot: plant, water, harvest. You may explain these actual steps; do not claim to perform player actions.`;}
  refreshVisuals(){const g=this.g,h=g.habitat;
    if(h.layer&&this.layout!==h.layer.layout){this.props?.dispose();this.layout=h.layer.layout;
      const changed=bindActivityRooms(g.activities,this.layout.rooms);this.props=createActivityProps(h.scene,this.layout,g.activities);if(changed)g.persist();}
    const visual={...g.activities,reducedMotion:g.settings.reducedMotion};this.site.update(g.t,visual);this.props?.update(g.t,visual,h.depth);
    const packed=['carried','equipped'].includes(g.activities.worker);this.carry.group.visible=packed&&!h.active&&!g.under.active&&!g.inLander;
    const parent=g.driving?g.buggyLayer.group:g.colonist.group;if(this.carry.group.parent!==parent)parent.add(this.carry.group);
    this.carry.group.position.set(g.driving?0:.3,g.driving?1.0:1.12,g.driving?-.9:-.23);this.carry.update(g.t,{reducedMotion:g.settings.reducedMotion});
  }
  step(dt){const g=this.g;if(g.attract){this.ui.hidden=true;this.site.group.visible=false;this.carry.group.visible=false;return;}
    this.site.group.visible=true;const previous=g.activities.routeOpen,phase=g.activities.crop.phase;
    tickHabitatActivities(g.activities,dt,{paused:this.blocked(),sealed:!!g.burrow.ringInstalled,gardenPresent:[...g.burrow.cells.values()].some(c=>c.piece==='garden'&&c.dug>=1)});
    if(previous!==g.activities.routeOpen||phase!==g.activities.crop.phase){g.persist();this.message=g.activities.routeOpen&&!previous?'Field entrance cleared. Return to the service hatch.':'Your nursery tomatoes are ready to harvest.';g.hud.say(this.message,g.t,6);}
    this.refreshVisuals();const c=this.context(),near=c.nearWorker||c.nearHatch;
    this.ui.hidden=this.blocked()||g.habitat.active||g.under.active||g.inLander||g.driving||!!g.hopFlight||(!near&&!g.activities.rations);
    this.ui.querySelector('b').textContent=near?'Field service hatch':'Packed harvest';
    this.ui.querySelector('p').textContent=near?(g.activities.routeOpen?'New entrance into the workings.':g.activities.worker==='stranded'?'Disabled worker beside the hatch. Recover it for your workshop.':g.activities.worker==='deployed'?`Excavating: ${Math.floor(g.activities.routeProgress/12*100)}%`:'Repair at home; bring back the equipped worker.'):'A fresh ration gives a short rested breathing bonus.';
    const use=this.ui.querySelector('[data-act=use]');use.hidden=!near;use.textContent=g.activities.routeOpen?'Enter workings · E':g.activities.worker==='stranded'?'Recover worker · E':g.activities.worker==='equipped'?'Deploy worker · E':'Inspect hatch · E';
    const eat=this.ui.querySelector('[data-act=eat]');eat.hidden=!g.activities.rations;eat.textContent=`Eat tomato (${g.activities.rations})`;
  }
}

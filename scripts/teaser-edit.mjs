// Silent gameplay master: audio removed at the user's explicit request.
import { writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const dir='media/teaser60', master='marsstead-teaser-60s-v3.mp4';
const shots=JSON.parse(readFileSync(`${dir}/shot-list.json`));
if(shots.reduce((sum,s)=>sum+s.dur,0)!==60)throw new Error('Edit must total 60 seconds');
writeFileSync(`${dir}/concat.txt`,shots.map(s=>`file '${s.id}.mp4'`).join('\n'));
const run=args=>{
 const r=spawnSync('ffmpeg',['-hide_banner','-y',...args],{encoding:'utf8',maxBuffer:4e6});
 if(r.status!==0)throw new Error(r.stderr||'FFmpeg failed');
};
run(['-f','concat','-safe','0','-i',`${dir}/concat.txt`,'-map','0:v:0',
 '-vf','fade=t=in:st=0:d=0.5,fade=t=out:st=59:d=1',
 '-c:v','libx264','-preset','slow','-crf','17','-pix_fmt','yuv420p','-an',
 '-t','60','-movflags','+faststart',`${dir}/${master}`]);
run(['-ss','43','-i',`${dir}/${master}`,'-frames:v','1',`${dir}/poster-v3.jpg`]);
run(['-v','error','-i',`${dir}/${master}`,'-f','null','-']);
const probe=spawnSync('ffprobe',['-v','error','-show_entries',
 'format=duration,size:stream=codec_name,width,height,r_frame_rate,duration','-of','json',`${dir}/${master}`],{encoding:'utf8'});
if(probe.status!==0)throw new Error(probe.stderr);
const info=JSON.parse(probe.stdout);
if(Number(info.format.duration)!==60||info.streams.length!==1||info.streams[0].codec_name!=='h264')throw new Error('Expected exactly 60 seconds of silent H264 video');
writeFileSync(`${dir}/probe-v3.json`,probe.stdout);
writeFileSync(`${dir}/index.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Marsstead — silent gameplay teaser</title><style>body{margin:0;background:#080b0c;color:#efe7dc;font:16px system-ui}main{max-width:1280px;margin:32px auto;padding:12px}video{width:100%;display:block}h1{font-weight:400;letter-spacing:6px}a{color:#e5bd86}</style><main><h1>MARSSTEAD</h1><video controls playsinline preload="metadata" poster="poster-v3.jpg" src="${master}"></video><p>60 seconds · expanded greenhouse · rocket landing · no soundtrack · development gameplay</p><a href="${master}" download>Download revised MP4</a></main></html>`);
console.log(probe.stdout);

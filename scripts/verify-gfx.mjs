// verify-gfx: the graphics rig's pure decisions — exposure drive, opening
// tier, fps watchdog. The renderer-side application (ACES, the composer)
// is asserted source-level in verify-look.mjs, the Moorstead workaround
// for modules that boot at import.

import {
  EXPOSURE_BASE, exposureTarget, decideTier, isSoftwareGL,
  fpsVerdict, median, SETTLE_S, WINDOW_S, SLOW_FINE, SLOW_PLAIN,
} from '../src/gfx.js';
import { dayFactor } from '../src/marslight.js';

let failed = 0;
function check(name, ok, detail = '') {
  if (ok) { console.log(`  ok  ${name}`); } else { failed++; console.error(`FAIL  ${name} ${detail}`); }
}

// 1. exposure: bright midday low, night opens the iris, base inside the range
{
  const day = exposureTarget(1), night = exposureTarget(0);
  check('exposure: midday 1.15', Math.abs(day - 1.15) < 1e-9, `${day}`);
  check('exposure: night 1.32', Math.abs(night - 1.32) < 1e-9, `${night}`);
  check('exposure: monotone with dark', exposureTarget(0.25) > exposureTarget(0.75));
  check('exposure: base inside the swing', EXPOSURE_BASE > day && EXPOSURE_BASE < night);
}

// 2. dayFactor is the shared clock: full day by +8 deg, gone by -6
{
  check('dayFactor: noon 1', dayFactor(45) === 1);
  check('dayFactor: deep night 0', dayFactor(-20) === 0);
  check('dayFactor: twilight between', dayFactor(1) > 0 && dayFactor(1) < 1);
}

// 3. the opening tier: player > memory > floor signals > webgpu > optimism
{
  check('tier: chosen fine wins', decideTier({ stored: 'fine', webgpu: false }).tier === 'fine');
  check('tier: chosen plain wins', decideTier({ stored: 'plain', webgpu: true }).tier === 'plain');
  check('tier: auto-plain remembered', decideTier({ stored: 'auto-plain', webgpu: true }).tier === 'plain');
  check('tier: software GL floors it', decideTier({ rendererStr: 'SwiftShader' }).tier === 'plain');
  check('tier: low memory floors it', decideTier({ deviceMemory: 2, webgpu: true }).tier === 'plain');
  check('tier: few cores floors it', decideTier({ cores: 2, webgpu: true }).tier === 'plain');
  check('tier: touch opens easy', decideTier({ touchPrimary: true, webgpu: true }).tier === 'plain');
  check('tier: webgpu opens fine', decideTier({ webgpu: true }).tier === 'fine');
  check('tier: no webgpu opens plain', decideTier({ webgpu: false }).tier === 'plain');
  check('tier: unprobed is optimistic', decideTier({}).tier === 'fine');
}

// 4. software-GL detection
{
  check('softGL: swiftshader', isSoftwareGL('Google SwiftShader'));
  check('softGL: llvmpipe', isSoftwareGL('Mesa/X.org llvmpipe (LLVM 15.0.7)'));
  check('softGL: basic render driver', isSoftwareGL('Microsoft Basic Render Driver'));
  check('softGL: a real GPU is not', !isSoftwareGL('NVIDIA GeForce RTX 4070'));
  check('softGL: null is not', !isSoftwareGL(null));
}

// 5. the watchdog only ever eases down, on real numbers
{
  check('watchdog: fine holds at 60', fpsVerdict('fine', 60) === 'hold');
  check('watchdog: fine drops below floor', fpsVerdict('fine', SLOW_FINE - 1) === 'drop-plain');
  check('watchdog: plain sheds pixels', fpsVerdict('plain', SLOW_PLAIN - 1) === 'drop-pixels');
  check('watchdog: plain holds above floor', fpsVerdict('plain', SLOW_PLAIN + 3) === 'hold');
  check('watchdog: NaN holds', fpsVerdict('fine', NaN) === 'hold');
  check('watchdog: windows sane', SETTLE_S > 0 && WINDOW_S > 0 && SLOW_FINE > SLOW_PLAIN);
}

// 6. median
{
  check('median: odd', median([3, 1, 2]) === 2);
  check('median: even', median([4, 1, 2, 3]) === 2.5);
  check('median: empty is NaN', Number.isNaN(median([])));
}

if (failed) { console.error(`verify-gfx: ${failed} FAILED`); process.exit(1); }
console.log('verify-gfx: all green');

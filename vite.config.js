// Dev-only: the same-origin /brain path the client speaks (VESPER's relay)
// is a Vercel rewrite in production; in dev, Vite proxies it to the EVO
// tunnel so the live voice works from `npm run dev` too.
// Build-only: __APP_VERSION__ + version.json drive the in-app update prompt
// (src/update-check.js), the same scheme as Moorstead's.
import { readFileSync } from 'node:fs';

// Single source of truth for the running version = package.json "version".
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const APP_VERSION = pkg.version;
const MIN_CLIENT_VERSION = pkg.minClientVersion || pkg.version;

// Tiny plugin: drop a fresh version.json into the deploy so a running client can
// fetch it (cache-busted) and compare against its own baked-in __APP_VERSION__.
// { version } drives the Notify toast; { min } drives the Force auto-reload.
function emitVersionJson() {
  return {
    name: 'marsstead-emit-version-json',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: APP_VERSION, min: MIN_CLIENT_VERSION }),
      });
    },
  };
}

export default {
  // Bake the build's version into the client so it knows what it's running,
  // with no network call. The update check compares this to a fetched version.json.
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [emitVersionJson()],
  server: {
    proxy: {
      '/brain': { target: 'https://marsstead.sovren.xyz', changeOrigin: true },
      '/dash': { target: 'https://saltstead.sovren.xyz', changeOrigin: true },
    },
  },
};

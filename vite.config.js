// Dev-only: the same-origin /brain path the client speaks (VESPER's relay)
// is a Vercel rewrite in production; in dev, Vite proxies it to the EVO
// tunnel so the live voice works from `npm run dev` too.
export default {
  server: {
    proxy: {
      '/brain': { target: 'https://marsstead.sovren.xyz', changeOrigin: true },
      '/dash': { target: 'https://saltstead.sovren.xyz', changeOrigin: true },
    },
  },
};

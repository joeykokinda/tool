# tools

Everyday tools at https://tools.jkokinda.com. Static Vite + React site, everything runs in the browser and the CSP blocks all outbound requests.

- `npm run dev` local dev
- `npm test` wallet derivation check against known vectors
- Deploys on push to `master`: Cloudflare Pages project `tool` runs `npm run build` and serves `build/`

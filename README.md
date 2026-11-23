# tools

Everyday tools at https://tools.jkokinda.com. Static Vite + React site, everything runs in the browser and the CSP blocks all outbound requests.

- `npm run dev` local dev
- `npm test` wallet derivation check against known vectors
- Deploys on push to `master`: Cloudflare Pages project `tool` runs `npm run build` and serves `build/`

## YouTube downloader

`/yt/` is a standalone page (`public/yt/`) that talks to `server/`, a small Go service wrapping yt-dlp. It runs on brach as the user unit `ytserver.service`, published with `tailscale funnel --https=10000`. The password lives in `~/.config/ytserver/env` on brach, never in this repo.

Redeploy the service: `cd server && go test ./... && CGO_ENABLED=0 go build -o ytserver . && scp ytserver brach:ytserver/ && ssh brach systemctl --user restart ytserver`

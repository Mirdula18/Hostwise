# Deployment — Cloudflare Pages

## 1. One-time setup
1. Push the repo to GitHub as a **public** repository.
2. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages → Connect to Git** and select the repo.
3. Build settings:

   | Setting | Value |
   |---|---|
   | Framework preset | None (or Vite) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | `/` |
   | Environment variable | `NODE_VERSION` = `20` |

4. Under **Settings → Variables and Secrets**, add these for both Production and Preview:
   - `GEMINI_API_KEY`, as type **Secret**.
   - `GEMINI_MODEL`, as plain text, set to a current Gemini Flash model name from Google AI Studio.
5. Deploy. The `functions/` folder is detected automatically, and `/api/gemini` becomes live.

## 2. CLI alternative
```bash
npx wrangler login
npx wrangler pages project create hostwise
npx wrangler pages secret put GEMINI_API_KEY --project-name hostwise
npx wrangler pages secret put GEMINI_MODEL --project-name hostwise   # or set it as plain text in the dashboard
npm run build && npx wrangler pages deploy dist --project-name hostwise
```

## 3. `wrangler.toml`
```toml
name = "hostwise"
pages_build_output_dir = "dist"
compatibility_date = "2026-10-01"
```
There is deliberately no `[vars]` block. When a Pages project has a `wrangler.toml`, plain variables in it override the dashboard, so an empty `GEMINI_MODEL` there would hide the value you set in step 4. If `GEMINI_MODEL` is unset, the function falls back to `gemini-2.5-flash`.

The origin allow-list in `functions/api/gemini.ts` accepts `hostwise.pages.dev` and its preview subdomains. If your Pages project has a different name, update `PAGES_ORIGIN` there (same-origin requests on a custom domain are always allowed).

## 4. Local development
```bash
cp .dev.vars.example .dev.vars   # GEMINI_API_KEY=...  GEMINI_MODEL=...
npm run build                    # once, so wrangler has a dist/ to serve
npm run dev:api                  # wrangler pages dev --port 8788 (serves functions)
npm run dev                      # vite :5173, proxies /api -> :8788
```

## 5. Post-deploy checks
Verified on 2026-11-01 against https://hostwise.pages.dev:

- [x] Open `https://hostwise.pages.dev` (or your project URL) in an incognito window. It loads with no login.
- [x] "Use sample event" works, and an AI action succeeds (the Network tab shows `/api/gemini` returning 200).
- [x] The response headers include the CSP (DevTools → Network → document).
- [x] Search the page source and JS bundles for `AIza`: no matches.
- [x] `curl -X POST https://<url>/api/gemini -d '{}'` returns 400 or 403 and doesn't crash.
- [x] Deep link `/event/xyz` loads the SPA (via `_redirects`).

## 6. Optional extras
- **Web Analytics:** turn it on in the Pages project settings; no code is needed.
- **WAF rate-limiting rule:** path `/api/*`, 30 requests per minute per IP. This adds protection on top of the in-memory limiter.

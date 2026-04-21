# inqshop

Public site for **iNQshop — Garage Schooling**: curriculum strands from **PreK (age 2+)** through advanced work, including **engines & propulsion**, notebooks, outputs, and a growth pathway. **Physical build** (layout, zones, blueprints, phased construction) lives on the sibling site **[garage.castalia.institute](https://garage.castalia.institute)** (`InquiryInstitute/garage`).

- **Live site:** https://inqshop.castalia.institute (GitHub Pages)
- **Source brief:** `inqshop_design_document.pdf` (authoritative layout figures and extended notes)

## Repository layout

| Path | Purpose |
|------|---------|
| `docs/` | Static site served by GitHub Pages (`/` path on `main`) |
| `docs/CNAME` | `inqshop.castalia.institute` |
| Partner | [InquiryInstitute/garage](https://github.com/InquiryInstitute/garage) → **garage.castalia.institute** (room build only) |
| `docs/assets/*.png` | Hero + gallery images (generated; not committed until you run the script) |
| `scripts/generate-inqshop-images.mjs` | Gemini image generation (“Nano Banana” / `gemini-2.5-flash-image`, same pattern as `Inquiry.Institute/supabase/functions/generate-busts`) |

## Hero images (Google Gemini / Nano Banana)

From the **inqshop** repo root. The script loads **`../Inquiry.Institute`** env files in merge order (later overrides earlier; your shell still wins): **`.env`**, **`.env.local`**, **`.env.development.local`**, **`gcp/faculty-runner/.env`**, **`gcp/faculty-runner/.env.local`**. Uses **`GCP_API_KEY`**, **`GEMINI_API_KEY`**, or **`GOOGLE_API_KEY`** (same as `generate-busts`):

```bash
node scripts/generate-inqshop-images.mjs
```

That writes four PNGs into `docs/assets/` (`hero-makerspace.png`, three gallery shots). Commit them if you want them served from GitHub Pages. Optional: set `GEMINI_IMAGE_MODEL` to a comma-separated list of model ids to match your AI Studio access.

## Deploy

Pages is configured for branch `main`, folder `/docs`. Push to `main` to publish.

## DNS (Cloudflare)

The `castalia.institute` zone uses the Cloudflare API token from the main Castalia repo (sourced from `../Inquiry.Institute/.env` or `.env.local` — see that repo’s `.env.local.example`). CNAME: `inqshop` → `inquiryinstitute.github.io` (proxied).

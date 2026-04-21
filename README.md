# inqshop

Public concept site for **Castalia iNQshop**: the physical making complement to iNQspace — garage-scale workshop layout, curriculum strands, safety and zones, blueprint packages, and alignment with the broader Castalia web map.

- **Live site:** https://inqshop.castalia.institute (GitHub Pages)
- **Source brief:** `inqshop_design_document.pdf` (authoritative layout figures and extended notes)

## Repository layout

| Path | Purpose |
|------|---------|
| `docs/` | Static site served by GitHub Pages (`/` path on `main`) |
| `docs/CNAME` | Custom hostname for Pages |

## Deploy

Pages is configured for branch `main`, folder `/docs`. Push to `main` to publish.

## DNS (Cloudflare)

The `castalia.institute` zone uses the Cloudflare API token from the main Castalia repo (sourced from `../Inquiry.Institute/.env` or `.env.local` — see that repo’s `.env.local.example`). CNAME: `inqshop` → `inquiryinstitute.github.io` (proxied).

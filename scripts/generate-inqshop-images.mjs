#!/usr/bin/env node
/**
 * Generate iNQshop hero/gallery images via Google Gemini image generation
 * ("Nano Banana" — same stack as Inquiry.Institute supabase/functions/generate-busts).
 *
 * Loads API key from (first hit in process.env):
 *   GCP_API_KEY, GEMINI_API_KEY, GOOGLE_API_KEY (same as generate-busts).
 * Then merges (later overrides earlier; does not override already-set shell env):
 *   ../Inquiry.Institute/.env, .env.local, .env.development.local,
 *   ../Inquiry.Institute/gcp/faculty-runner/.env and .env.local
 *   (also ../castalia.institute/… if that folder exists)
 *
 * Usage (from repo root):
 *   node scripts/generate-inqshop-images.mjs
 *
 * Optional: GEMINI_IMAGE_MODEL=model-id (comma-separated fallbacks)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'docs', 'assets')

/** Parse KEY=value lines into an object (later files can override via Object.assign). */
function parseEnvFileToObject(filePath) {
  const out = {}
  if (!fs.existsSync(filePath)) return out
  const text = fs.readFileSync(filePath, 'utf8')
  for (let line of text.split('\n')) {
    line = line.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    let key = line.slice(0, eq).trim()
    if (key.startsWith('export ')) key = key.slice(7).trim()
    if (!key) continue
    let val = line.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

function inquiryInstituteEnvPaths(iiRoot) {
  return [
    path.join(iiRoot, '.env'),
    path.join(iiRoot, '.env.local'),
    path.join(iiRoot, '.env.development.local'),
    path.join(iiRoot, 'gcp', 'faculty-runner', '.env'),
    path.join(iiRoot, 'gcp', 'faculty-runner', '.env.local'),
  ]
}

function googleApiKey() {
  return (
    process.env.GCP_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  )
}

function geminiImageModels() {
  const raw = process.env.GEMINI_IMAGE_MODEL?.trim()
  if (raw) return raw.split(',').map((s) => s.trim()).filter(Boolean)
  return ['gemini-2.5-flash-image']
}

function base64ToBuffer(b64) {
  return Buffer.from(b64, 'base64')
}

function extractImageFromGeminiJson(data) {
  const candidates = data.candidates
  if (!Array.isArray(candidates) || !candidates.length) return null
  const parts = candidates[0]?.content?.parts
  if (!Array.isArray(parts)) return null
  for (const part of parts) {
    const inline = part.inlineData ?? part.inline_data
    if (!inline) continue
    const mime = inline.mimeType ?? inline.mime_type
    const b64 = inline.data
    if (b64 && typeof mime === 'string' && mime.startsWith('image/')) {
      try {
        return base64ToBuffer(b64)
      } catch {
        continue
      }
    }
  }
  return null
}

async function generateImageGemini(prompt) {
  const key = googleApiKey()
  if (!key) {
    throw new Error(
      'Set GCP_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY in the shell or in ../Inquiry.Institute/.env.local (overrides .env). Same keys as supabase/functions/generate-busts.',
    )
  }

  const models = geminiImageModels()
  let lastErr = ''

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE'],
      },
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const text = await resp.text()
    if (!resp.ok) {
      lastErr = `${model}: ${resp.status} ${text.slice(0, 500)}`
      continue
    }

    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      lastErr = `${model}: invalid JSON`
      continue
    }

    const buf = extractImageFromGeminiJson(parsed)
    if (buf && buf.length > 0) return { buf, model }
    lastErr = `${model}: no image in response`
  }

  throw new Error(lastErr || 'Gemini image generation failed')
}

const JOBS = [
  {
    file: 'hero-makerspace.png',
    prompt: `Photorealistic editorial photograph of a single-car American home garage converted into a bright, tidy family makerspace workshop. Center island workbench, pegboard with hand tools, cardboard and wood scraps organized in bins, soft morning light through the open garage door, warm wood tones, safe and inviting. No text, no logos, no brand names, no people's faces clearly identifiable.`,
  },
  {
    file: 'gallery-family-bench.png',
    prompt: `Photorealistic warm scene: back view or partial profile of a parent and two children of different ages working together at a garage workbench on a cardboard fort, everyone in casual clothes, hands busy, loving homeschool atmosphere. Faces not clearly recognizable or turned away. No text, no logos.`,
  },
  {
    file: 'gallery-toddler-paint.png',
    prompt: `Photorealistic close-up of a preschool child's hands and smock using chunky brushes and washable paint on large paper taped to a garage workshop table, jars of paint, paper towels, organized creative mess. No readable text, no logos.`,
  },
  {
    file: 'gallery-teen-fab.png',
    prompt: `Photorealistic teenager from behind at a workbench adjusting a small desktop 3D printer or assembling a robot kit in a home garage workshop, LED strip lighting, organized tools, focused maker mood. No logos, no readable text on shirts.`,
  },
]

function loadInquiryInstituteEnv() {
  const dirs = [
    path.join(ROOT, '..', 'Inquiry.Institute'),
    path.join(ROOT, '..', 'castalia.institute'),
  ]
  const merged = {}
  for (const ii of dirs) {
    if (!fs.existsSync(ii) || !fs.statSync(ii).isDirectory()) continue
    for (const f of inquiryInstituteEnvPaths(ii)) {
      Object.assign(merged, parseEnvFileToObject(f))
    }
  }
  for (const [key, val] of Object.entries(merged)) {
    if (process.env[key] === undefined) process.env[key] = val
  }
}

async function main() {
  loadInquiryInstituteEnv()

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  console.log('Output:', OUT_DIR)
  for (const job of JOBS) {
    process.stdout.write(`Generating ${job.file} ... `)
    const { buf, model } = await generateImageGemini(job.prompt)
    const outPath = path.join(OUT_DIR, job.file)
    fs.writeFileSync(outPath, buf)
    console.log(`OK (${buf.length} bytes, ${model})`)
  }
  console.log('Done.')
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})

#!/usr/bin/env node
/**
 * Generate iNQshop hero/gallery images via Google Gemini image generation
 * ("Nano Banana" — same stack as Inquiry.Institute supabase/functions/generate-busts).
 *
 * Loads API key from (first hit):
 *   GEMINI_API_KEY / GCP_API_KEY / GOOGLE_API_KEY in process.env, or
 *   ../Inquiry.Institute/.env and ../Inquiry.Institute/.env.local
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

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, 'utf8')
  for (let line of text.split('\n')) {
    line = line.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
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
      'Set GCP_API_KEY, GEMINI_API_KEY, or GOOGLE_API_KEY (e.g. in ../Inquiry.Institute/.env)',
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
    path.join(ROOT, '..', 'inquiry.institute'),
  ]
  for (const ii of dirs) {
    loadEnvFile(path.join(ii, '.env'))
    loadEnvFile(path.join(ii, '.env.local'))
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

// Generates dist/_headers for Cloudflare Pages. A headers file cannot read variables,
// so the API origin is substituted at build time.
import { writeFileSync, mkdirSync } from 'node:fs'

const api = (process.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '')
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tiles.openfreemap.org",
  "font-src 'self'",
  `connect-src 'self' ${api} https://tiles.openfreemap.org`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const headers = `/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=()
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/theme-init.js
  Cache-Control: public, max-age=3600
/index.html
  Cache-Control: no-cache
`
mkdirSync('dist', { recursive: true })
writeFileSync('dist/_headers', headers)
console.log('wrote dist/_headers for', api)

// Fails the build when the landing JavaScript is over budget or an unexpected font ships.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const LIMIT_KB = 200
const assets = join('dist', 'assets')
const files = readdirSync(assets)
const html = readFileSync(join('dist', 'index.html'), 'utf8')
const entry = [...html.matchAll(/assets\/([^"']+\.js)/g)].map((m) => m[1])
let landing = 0
for (const f of entry) landing += gzipSync(readFileSync(join(assets, f))).length
console.log(`landing JS (gzip): ${(landing / 1024).toFixed(1)} KB, limit ${LIMIT_KB} KB`)
for (const f of files.filter((f) => f.endsWith('.js'))) {
  console.log(`  ${f}  ${(gzipSync(readFileSync(join(assets, f))).length / 1024).toFixed(1)} KB gzip`)
}
const fonts = files.filter((f) => /\.woff2?$/.test(f))
const bad = fonts.filter((f) => !/latin-wght-normal/.test(f))
if (bad.length) {
  console.error('Unexpected font files:', bad)
  process.exit(1)
}
if (landing > LIMIT_KB * 1024) {
  console.error('Landing bundle is over budget')
  process.exit(1)
}
void statSync

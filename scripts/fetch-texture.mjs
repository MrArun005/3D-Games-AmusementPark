// Usage: node scripts/fetch-texture.mjs <ambientCG-file> <destDir>
import { mkdirSync, rmSync } from 'node:fs'
import { execSync } from 'node:child_process'
const [file, dest] = process.argv.slice(2)
if (!file || !dest) { console.error('usage: fetch-texture.mjs <file.zip> <destDir>'); process.exit(1) }
mkdirSync(dest, { recursive: true })
const zip = `${dest}/_dl.zip`
execSync(`curl -L -o "${zip}" "https://ambientcg.com/get?file=${file}"`, { stdio: 'inherit' })
execSync(`unzip -o "${zip}" -d "${dest}"`, { stdio: 'inherit' })
rmSync(zip)
console.log('done:', dest)

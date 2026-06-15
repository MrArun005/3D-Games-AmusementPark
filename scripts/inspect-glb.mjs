// Prints mesh names + animation clip names for a GLB so we can wire characters.ts.
// Usage: node scripts/inspect-glb.mjs public/models/characters/<file>.glb
import { NodeIO } from '@gltf-transform/core'

const path = process.argv[2]
if (!path) { console.error('usage: node scripts/inspect-glb.mjs <file.glb>'); process.exit(1) }
const io = new NodeIO()
const doc = await io.read(path)
const root = doc.getRoot()
console.log('MESHES:')
for (const m of root.listMeshes()) console.log('  -', JSON.stringify(m.getName()))
console.log('ANIMATIONS:')
for (const a of root.listAnimations()) console.log('  -', JSON.stringify(a.getName()))
console.log('SKINS:', root.listSkins().length)

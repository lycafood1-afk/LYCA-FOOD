import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
const roots = ['public/images', 'public/fonts', 'src/assets']
let count = 0
for (const root of roots) {
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const file = path.join(entry.parentPath, entry.name)
    const bytes = await readFile(file)
    if (bytes.subarray(0, 150).toString().includes('version https://git-lfs.github.com/spec/v1')) {
      throw new Error(`${file} is a Git LFS pointer. Restore the original asset from the supplied ZIP, then run git add --renormalize public src/assets before committing.`)
    }
    if (!bytes.length) throw new Error(`Empty website asset: ${file}`)
    count++
  }
}
console.log(`Verified ${count} local website assets; no Git LFS pointers.`)

const fs = require('fs')
const path = require('path')

const vueDir = path.join(__dirname, 'src')
const overlayFiles = []
const keyIndexFiles = []

function walk(dir) {
  const files = fs.readdirSync(dir)
  for (const f of files) {
    const fullPath = path.join(dir, f)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      walk(fullPath)
    } else if (f.endsWith('.vue')) {
      const content = fs.readFileSync(fullPath, 'utf8')
      if (content.includes('<VOverlay :model-value="isLoading"')) {
        overlayFiles.push(path.relative(vueDir, fullPath))
      }
      if (/:key=['"]index['"]/.test(content)) {
        keyIndexFiles.push(path.relative(vueDir, fullPath))
      }
    }
  }
}

walk(vueDir)
console.log('Overlay Files:', overlayFiles.length)
overlayFiles.forEach(f => console.log('  - ' + f))
console.log('\nKey Index Files:', keyIndexFiles.length)
keyIndexFiles.forEach(f => console.log('  - ' + f))

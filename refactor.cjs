const fs = require('fs')
const path = require('path')

const vueDir = path.join(__dirname, 'src')

function walk(dir, callback) {
  const files = fs.readdirSync(dir)
  for (const f of files) {
    const fullPath = path.join(dir, f)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      walk(fullPath, callback)
    } else if (f.endsWith('.vue') || f.endsWith('.js')) {
      callback(fullPath)
    }
  }
}

let modifiedFiles = 0

walk(vueDir, filePath => {
  let content = fs.readFileSync(filePath, 'utf8')
  let originalContent = content

  // 1. Remove local VOverlays with isLoading
  const overlayRegex = /<VOverlay[^>]*:model-value="isLoading"[^>]*>[\s\S]*?<\/VOverlay>/g

  content = content.replace(overlayRegex, '<!-- Global loader in use -->')

  // 2. Replace :key="index" with a safer fallback in v-for loops
  const keyIndexRegex = /:key=['"]index['"]/g


  // We use a safe fallback: if item has id, use it, else if product_id, else fallback to index.
  // Assuming the loop variable is named 'item' or similar. We will just use item.id || index.
  // Since we don't know the loop variable name for sure, a generic one if it's item:
  // Actually, looking at the grep, most are `(item, index) in ...` or `(dist, index) in ...`
  // We can replace it with:
  // :key="(typeof item !== 'undefined' && item.id) ? item.id : ((typeof item !== 'undefined' && item.product_id) ? item.product_id : index)"
  // Or simpler: :key="typeof item !== 'undefined' ? (item.id || item.product_id || index) : index"
  content = content.replace(keyIndexRegex, `:key="(typeof item !== 'undefined' ? (item.id || item.product_id || index) : (typeof dist !== 'undefined' ? (dist.id || index) : index))"`)

  // 3. Fix api.js reload loop
  if (filePath.endsWith('api.js')) {
    content = content.replace(/window\.location\.reload\(\);/g, "window.location.href = '/login';")
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8')
    modifiedFiles++
    console.log('Modified:', path.relative(__dirname, filePath))
  }
})

console.log(`\nRefactoring complete. ${modifiedFiles} files modified.`)

const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const dir = path.join(__dirname, 'src');

walkDir(dir, function(filePath) {
  if (filePath.endsWith('.vue') || filePath.endsWith('.js') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Fix new Date().toISOString().split('T')[0]
    content = content.replace(/new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]/g, 
      "new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0]");

    // Fix new Date().toISOString().slice(0, 10)
    content = content.replace(/new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)/g, 
      "new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0]");

    // Fix new Date().toISOString().substr(0, 10)
    content = content.replace(/new Date\(\)\.toISOString\(\)\.substr\(0,\s*10\)/g, 
      "new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().split('T')[0]");
      
    // Fix d.toISOString().slice(0, 10)
    content = content.replace(/d\.toISOString\(\)\.slice\(0,\s*10\)/g, 
      "new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]");

    // Fix new Date().toISOString() without slice or split
    content = content.replace(/created_at:\s*new Date\(\)\.toISOString\(\)/g, 
      "created_at: new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString()");

    if (original !== content) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Fixed:', filePath);
    }
  }
});

const fs = require('fs');
const files = [
    'src/pages/finanzas/employee-expenses.vue',
    'src/pages/aportes/index.vue',
    'src/pages/movements/index.vue',
    'src/pages/transfers/index.vue'
];

files.forEach(f => {
    let content = fs.readFileSync(f);
    let str = content.toString('utf8');
    
    // Fix corrupted text: look for <style scoped> or </style> and remove anything after it.
    const idx = str.lastIndexOf('</style>');
    if (idx !== -1) {
        str = str.substring(0, idx + 8);
    }

    // Add the yaml block
    str += '\n\n<route lang="yaml">\nmeta:\n  navActiveLink: \'operations-index\'\n</route>\n';
    
    fs.writeFileSync(f, str, 'utf8');
});

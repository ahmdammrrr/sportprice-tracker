const fs = require('fs');

const html = fs.readFileSync('oc.html', 'utf8');

// Cari "combination" yang biasanya mengandungi saiz di SiteGiant
const combRegex = /combination[^{]*\{[^}]*\}/gi;
let match;
let count = 0;
while ((match = combRegex.exec(html)) !== null && count < 5) {
    const cleaned = match[0].replace(/\\"/g, '"');
    console.log(`Combination #${count}: ${cleaned.substring(0, 300)}`);
    count++;
}

// Cari semua "options" yang berkaitan size
console.log('\n\n=== Cari "options" ===');
const optionsRegex = /options[\\]*":\s*\[[^\]]{10,2000}\]/g;
count = 0;
while ((match = optionsRegex.exec(html)) !== null && count < 5) {
    const cleaned = match[0].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    if (cleaned.toLowerCase().includes('size') || cleaned.match(/\d{2}(\.\d)?/)) {
        console.log(`\nOptions #${count}: ${cleaned.substring(0, 500)}`);
        count++;
    }
}

// Tunjukkan konteks sekitar perkataan "Size" yang paling dekat dengan data produk
console.log('\n\n=== Konteks "Size" dekat data produk ===');
const sizeContextRegex = /[Ss]ize[^]*?(?=Color|colour|\\n|$)/g;
count = 0;
let idx = 0;
while ((idx = html.indexOf('Size', idx)) !== -1 && count < 5) {
    const context = html.substring(idx, idx + 400).replace(/\\"/g, '"');
    if (context.includes('option') || context.includes('value') || context.match(/\d{2}/)) {
        console.log(`\nIndex ${idx}: ${context}`);
        count++;
    }
    idx += 100;
}

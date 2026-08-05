const axios = require('axios');
const fs = require('fs');

const SCRAPER_API_KEY = '9827cd6d5c6140e38b8600b3d84efd78';
const TARGET_URL = 'https://www.sportsdirect.com.my/adidas-techfit-compression-training-3-stripes-mens-base-layer-top-427034';

async function debug() {
    console.log('Fetching page...');
    try {
        const response = await axios.get('http://api.scraperapi.com', {
            params: {
                api_key: SCRAPER_API_KEY,
                url: TARGET_URL,
                render: 'true', // Test dengan render
                country_code: 'my'
            },
            timeout: 90000
        });

        const html = response.data;
        console.log('HTML length:', html.length);

        // Save raw HTML
        fs.writeFileSync('debug_apparel.html', html);
        console.log('Saved to debug_apparel.html');

        // Test regex baru
        const sizeRegex = /sizeVariants\\+":\s*\[([^\]]*)\]/g;
        let sizeMatch;
        const found = [];
        const seenIds = new Set();

        while ((sizeMatch = sizeRegex.exec(html)) !== null) {
            console.log('\nFound sizeVariants block:');
            console.log('Raw:', sizeMatch[0].substring(0, 200));
            try {
                const unescaped = sizeMatch[1]
                    .replace(/\\\\"/g, '"')
                    .replace(/\\\\/g, '\\');
                const cleaned = '[' + unescaped + ']';
                const variants = JSON.parse(cleaned);
                variants.forEach(v => {
                    if (v.description && !seenIds.has(v.description)) {
                        seenIds.add(v.description);
                        found.push(v.description);
                    }
                });
            } catch(e) {
                console.log('JSON parse error:', e.message);
                // Fallback: manual regex
                const descMatches = [...sizeMatch[1].matchAll(/description\\*":\s*\\*"([^"\\]+)\\*"/g)];
                console.log('Fallback desc matches:', descMatches.map(m => m[1]));
            }
        }

        console.log('\n=== RESULT ===');
        console.log('Sizes found:', found);

        // Also check what patterns exist
        const hasVariants = html.includes('sizeVariants');
        const hasSwatchBtn = html.includes('swatch-button');
        const hasSizeM = html.includes('"M"');
        const hasSizeS = html.includes('"S"');
        console.log('\nPattern checks:');
        console.log('Has sizeVariants:', hasVariants);
        console.log('Has swatch-button:', hasSwatchBtn);
        console.log('Has "M":', hasSizeM);
        console.log('Has "S":', hasSizeS);

        // Find the exact context around sizeVariants
        const idx = html.indexOf('sizeVariants');
        if (idx >= 0) {
            console.log('\nContext around first sizeVariants:');
            console.log(html.substring(idx, idx + 400));
        } else {
            console.log('\nNO sizeVariants found in HTML!');
            // Check if there's any size-related data
            const idx2 = html.indexOf('variantId');
            if (idx2 >= 0) {
                console.log('Found variantId at:', idx2);
                console.log(html.substring(idx2, idx2 + 200));
            }
        }

    } catch(err) {
        console.error('Error:', err.message);
    }
}

debug();

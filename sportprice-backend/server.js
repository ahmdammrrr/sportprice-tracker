const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const path = require('path');
const nodemailer = require('nodemailer');
const dns = require('dns');

// Paksa Node.js untuk guna IPv4 berbanding IPv6 (untuk selesaikan masalah Nodemailer ENETUNREACH)
dns.setDefaultResultOrder('ipv4first');

dotenv.config();

// --- INISIALISASI NODEMAILER & TELEGRAM ---
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // gunakan false untuk port 587 (bermula tanpa TLS, kemudian di-upgrade)
    requireTLS: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
// Kita tak guna lagi TELEGRAM_CHAT_ID dari .env sebab kita nak ia dinamik

// --- INISIALISASI FIREBASE ADMIN ---
const serviceAccount = require('./serviceAccountKey.json');

// --- HACK PENYELARASAN MASA (System Time Hack) ---
try {
    const { execSync } = require('child_process');
    const headers = execSync('curl -I -s https://google.com', { encoding: 'utf-8' });
    const dateMatch = headers.match(/date:\s*(.+)/i);
    if (dateMatch) {
        const realTime = new Date(dateMatch[1]).getTime();
        const diff = realTime - Date.now();
        if (Math.abs(diff) > 60000) {
            const OriginalDate = Date;
            global.Date = class extends OriginalDate {
                constructor(...args) {
                    super(...args);
                    if (args.length === 0) return new OriginalDate(OriginalDate.now() + diff);
                }
                static now() { return OriginalDate.now() + diff; }
            };
            console.log(`🕒 System time auto-synced (+${Math.round(diff/60000)} min) to fix Firebase Error`);
        }
    }
} catch (e) {
    console.error('Time sync failed.');
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json()); // Membenarkan parse JSON request body



const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

// Fungsi normalisasi productId (dikongsi dengan frontend)
const normalizeProductId = (name) => {
    return name
        .toLowerCase()
        .replace(/black|white|blue|red|green|grey|yellow|orange|purple|pink/gi, '')
        .replace(/[A-Z]{2,}\d{3,}-\d+/gi, '')
        .replace(/men's|women's|men|women|junior|kid's|kids/gi, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .trim();
};

// 1. Pintu Utama
app.get('/', (req, res) => {
    res.send('🔥 Enjin Dynamic Multi-Source Scraper SportPrice Tracker sedia!');
});

// 2. Endpoint Dynamic Scrape
app.get('/scrape', async (req, res) => {
    // Kita ambil URL dari query parameter browser
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ error: 'Sila masukkan link kasut (url=...) dalam address bar!' });
    }

    try {
        console.log(`\n--- Memulakan Misi: ${targetUrl} ---`);
        
        const response = await axios.get('http://api.scraperapi.com', {
            params: {
                api_key: SCRAPER_API_KEY,
                url: targetUrl,
                render: 'true', // Penting untuk website yang banyak guna JavaScript
                country_code: 'my'
            },
            timeout: 60000 
        });

        const $ = cheerio.load(response.data);
        let productData = {};

        // ==========================================
        // LOGIK 1: UNTUK SPORTS DIRECT
        // ==========================================
        if (targetUrl.includes('sportsdirect.com')) {
            const fullName = $('h1').first().text().trim() || $('title').text().split('|')[0].trim();
            const brand = $('p[data-testid="product-card-brand"]').first().text().trim() || 
                          $('.ProductCard_brand__672nJ').first().text().trim() || 'Jenama Tidak Dijumpai';

            let price = $('.Price_isDiscounted__1HTC2').first().text().trim();
            if (!price) {
                price = $('p[data-testid="price"]').first().text().trim();
            }

            // Bersihkan harga kalau bercantum
            if (price.length > 10) {
                price = price.substring(0, price.indexOf('.00') + 3);
            }

            const imageUrl = $('img[data-testid="picture-img"]').first().attr('src') || 
                             $('.Image_image__wiRJI').first().attr('src');

            productData = {
                name: fullName,
                brand: brand,
                price: price,
                image: imageUrl,
                source: 'Sports Direct'
            };
        } 
        // ==========================================
        // LOGIK 2: UNTUK AL-IKHSAN
        // ==========================================
        else if (targetUrl.includes('al-ikhsan.com')) {
            let rawName = $('h1').text().trim() || $('.product-title').text().trim();
            let brandName = 'Al-Ikhsan'; // Default fallback

            // Asingkan jenama secara automatik berdasarkan nama
            if (rawName.toUpperCase().includes('ASICS')) {
                brandName = 'Asics';
            } else if (rawName.toUpperCase().includes('NIKE')) {
                brandName = 'Nike';
            } else if (rawName.toUpperCase().includes('ADIDAS')) {
                brandName = 'Adidas';
            } else if (rawName.toUpperCase().includes('PUMA')) {
                brandName = 'Puma';
            }

            // Cari harga (Shopify style)
            let price = $('.price-item--sale').first().text().trim();
            if (!price) {
                price = $('.price-item--regular').first().text().trim() || $('.price').first().text().trim();
            }
            
            // Bersihkan harga Al-Ikhsan
            if (price.includes('RM')) {
                 let tempPrice = price.substring(price.indexOf('RM'));
                 price = tempPrice.substring(0, tempPrice.indexOf('.00') + 3);
            }

            let imageUrl = $('img.lazy-image').first().attr('src') || $('div.product-item__image img').first().attr('src');
            if (imageUrl && imageUrl.startsWith('//')) {
                imageUrl = 'https:' + imageUrl;
            }

            productData = {
                name: rawName || 'Nama Tidak Dijumpai',
                brand: brandName,
                price: price || 'Harga Tidak Dijumpai',
                image: imageUrl,
                source: 'Al-Ikhsan'
            };
        } 
        // ==========================================
        // JIKA WEBSITE LAIN
        // ==========================================
        else {
            return res.status(400).json({ 
                error: 'Website ini belum disokong. Sila guna link Sports Direct atau Al-Ikhsan sahaja buat masa ini.' 
            });
        }

        // --- BUNGKUS HASIL DAN HANTAR ---
        const result = {
            status: 'Success',
            data: {
                ...productData,
                link: targetUrl,
                scrapedAt: new Date().toLocaleString()
            }
        };

        console.log(`✅ Berjaya Tarik: ${result.data.name} dari ${result.data.source}`);
        res.json(result);

    } catch (error) {
        console.error("❌ Error:", error.message);
        res.status(500).json({ error: 'Gagal tarik data. Link mungkin salah atau credit habis.', detail: error.message });
    }
});

// Endpoint Semak Saiz Secara Berasingan (Untuk ProductDetails sahaja)
app.get('/check-sizes', async (req, res) => {
    const { url, source } = req.query;

    if (!url || !source) {
        return res.status(400).json({ error: 'Sila berikan url dan source.' });
    }

    // =====================================================
    // KAEDAH KHAS AL-IKHSAN: Shopify JSON API (Tanpa ScraperAPI!)
    // Pantas (~2s), Percuma (0 kredit), Hampir 100% berjaya
    // =====================================================
    if (source === 'Al-Ikhsan') {
        try {
            // Bersihkan URL: Buang query string (?_pos=1&_sid=...) dan tambah .json
            const cleanUrl = url.split('?')[0];
            const jsonUrl = cleanUrl.endsWith('.json') ? cleanUrl : cleanUrl + '.json';
            
            console.log(`\n[+] Semak Saiz Al-Ikhsan (Shopify JSON API): ${jsonUrl}`);

            const response = await axios.get(jsonUrl, { timeout: 15000 });
            const product = response.data.product;
            
            if (product && product.variants) {
                // Ambil SEMUA saiz yang wujud (medan 'available' mungkin tiada dalam JSON Shopify)
                // Jika 'available' wujud, guna ia. Jika tiada, anggap ia tersedia.
                const availableSizes = product.variants
                    .filter(v => v.available !== false) // Hanya tolak jika SECARA EKSPLISIT 'false'
                    .map(v => v.title);                 // Ambil nama saiz (cth: "UK 7", "UK 8")

                console.log(`✅ Al-Ikhsan (JSON): Jumpa ${availableSizes.length} saiz tersedia daripada ${product.variants.length} jumlah variant.`);
                
                return res.json({
                    status: 'Success',
                    source: source,
                    sizes: availableSizes
                });
            }

            // Jika tiada variant dalam JSON, kembalikan senarai kosong
            console.log(`[!] Al-Ikhsan (JSON): Tiada variant dijumpai.`);
            return res.json({ status: 'Success', source: source, sizes: [] });

        } catch (error) {
            console.error(`Error semak saiz Al-Ikhsan (JSON):`, error.message);
            // Jika JSON API gagal, kembalikan ralat (tanpa fallback ke ScraperAPI untuk jimat kredit)
            return res.json({ status: 'Success', source: source, sizes: [] });
        }
    }
    // =====================================================
    // KAEDAH KHAS SPORTS DIRECT: Tanpa Render (1 kredit sahaja!)
    // Data sizeVariants tertanam di dalam HTML sebagai JSON
    // =====================================================
    if (source === 'Sports Direct') {
        const MAX_RETRIES = 2;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            const dynamicTimeout = attempt === 1 ? 30000 : 60000;
            try {
                console.log(`\n[+] Semak Saiz Sports Direct (Tanpa Render, Cubaan ${attempt}/${MAX_RETRIES}): ${url}`);
                
                const response = await axios.get('http://api.scraperapi.com', {
                    params: {
                        api_key: SCRAPER_API_KEY,
                        url: url,
                        country_code: 'my'
                        // TIADA render: 'true' — jimat 9 kredit!
                    },
                    timeout: dynamicTimeout
                });

                let availableSizes = [];
                const htmlData = response.data;

                // Kaedah 1: Ekstrak dari sizeVariants JSON tersembunyi di dalam <script>
                const sizeRegex = /sizeVariants[\\]*":\s*\[(.*?)\]/g;
                let sizeMatch;
                while ((sizeMatch = sizeRegex.exec(htmlData)) !== null) {
                    try {
                        // Bersihkan dan parse JSON
                        const cleaned = '[' + sizeMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\') + ']';
                        const variants = JSON.parse(cleaned);
                        variants.forEach(v => {
                            if (v.description && !availableSizes.includes(v.description)) {
                                availableSizes.push(v.description);
                            }
                        });
                    } catch (e) { /* Langkau jika JSON tidak sah */ }
                }

                // Kaedah 2 (Fallback): Cuba kaedah cheerio lama jika sizeVariants tiada
                if (availableSizes.length === 0) {
                    const $ = cheerio.load(htmlData);
                    $('div[data-testid="variant-selector-items"] button[data-testid="swatch-button-enabled"]').each((i, el) => {
                        let saiz = $(el).attr('value');
                        if (saiz) availableSizes.push(saiz);
                    });
                }

                if (availableSizes.length > 0 || attempt === MAX_RETRIES) {
                    console.log(`✅ Sports Direct: Jumpa ${availableSizes.length} saiz.`);
                    return res.json({ status: 'Success', source: source, sizes: availableSizes });
                }

                console.log(`[!] Saiz kosong untuk Sports Direct, cuba semula...`);
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                console.error(`Error semak saiz Sports Direct (Cubaan ${attempt}):`, error.message);
                if (attempt === MAX_RETRIES) {
                    return res.json({ status: 'Success', source: source, sizes: [] });
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    // =====================================================
    // KAEDAH BIASA: ScraperAPI + Render (Untuk Original Classic sahaja)
    // =====================================================
    const MAX_RETRIES = 2;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        // Timeout dinamik: Cubaan 1 (45s), Cubaan 2 (90s)
        const dynamicTimeout = attempt === 1 ? 45000 : 90000;

        try {
            console.log(`\n[+] Semak Saiz (Cubaan ${attempt}/${MAX_RETRIES}): ${source} - ${url}`);
            
            const response = await axios.get('http://api.scraperapi.com', {
                params: {
                    api_key: SCRAPER_API_KEY,
                    url: url,
                    render: 'true',
                    country_code: 'my'
                },
                timeout: dynamicTimeout
            });

            const $ = cheerio.load(response.data);
            let availableSizes = [];

            if (source === 'Original Classic') {
                $('.product-size-wrapper').each((i, wrapper) => {
                    // Pastikan kita hanya ambil blok yang ada tajuk 'size', bukan 'color'
                    const headerText = $(wrapper).find('h4').text().trim().toLowerCase();
                    if (headerText === 'size' || headerText.includes('size')) {
                        $(wrapper).find('ul li a').each((j, el) => {
                            // Elakkan ambil saiz yang dah habis stok (variant-disabled)
                            if (!$(el).hasClass('variant-disabled')) {
                                let saiz = $(el).find('div').first().text().trim();
                                if (saiz) availableSizes.push(saiz);
                            }
                        });
                    }
                });
            }

            // Jika berjaya dapat saiz ATAU ini cubaan terakhir, kembalikan keputusan
            if (availableSizes.length > 0 || attempt === MAX_RETRIES) {
                return res.json({
                    status: 'Success',
                    source: source,
                    sizes: availableSizes
                });
            }

            // Jika saiz kosong tetapi masih ada cubaan, tunggu 2 saat dan cuba lagi
            console.log(`[!] Saiz kosong untuk ${source}, cuba semula...`);
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.error(`Error semak saiz ${source} (Cubaan ${attempt}):`, error.message);
            
            // Jika ini cubaan terakhir, kembalikan ralat
            if (attempt === MAX_RETRIES) {
                return res.status(500).json({ error: 'Gagal mendapatkan saiz selepas beberapa cubaan' });
            }
            
            // Tunggu sebelum cuba semula
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
});

// 3. Endpoint Carian Berasaskan Kata Kunci (Live Keyword Search)
// --- FUNGSI ASAS: Lakukan HTTP Request ke ScraperAPI dan Parse HTML ---
const scrapeStore = async (storeName, targetUrl, parsingLogic, useRender = true, limit = 5) => {
    try {
        saveLog(`⏳ Sedang mencari di ${storeName}...`, 'info');
        
        // Konfigurasi ScraperAPI
        const params = {
            api_key: process.env.SCRAPER_API_KEY,
            url: targetUrl,
            country_code: 'my'
        };
        if (useRender) {
            params.render = 'true'; // Penting untuk SPA
        }
        
        const response = await axios.get('http://api.scraperapi.com', {
            params: params,
            timeout: 90000 
        });
        const $ = cheerio.load(response.data);
        const results = parsingLogic($, limit);
        saveLog(`✅ ${storeName}: Jumpa ${results.length} produk.`, 'success');
        return results;
    } catch (error) {
        saveLog(`❌ Ralat di ${storeName}: Pengekstrakan digugurkan (Bypassed).`, 'error');
        if (error.response) {
            console.error(`   Status Code: ${error.response.status}`);
        }
        // Konsep "Graceful Degradation": Kembalikan array kosong jika gagal, sistem takkan crash.
        return [];
    }
};

// --- Logik Ekstrak Al-Ikhsan ---
const alIkhsanLogic = ($, limit) => {
    const items = [];
    const seenLinks = new Set();
    $('.product-item, .grid-item').each((i, el) => {
        if (items.length >= limit) return false;
        
        const name = $(el).find('.product-item__title').text().replace(/\n/g, '').trim();
        const link = $(el).find('a.product-link').attr('href') || $(el).find('a').first().attr('href');
        
        let rawPrice = $(el).find('.new-price, .price').first().text().replace(/\n/g, '').trim();
        const priceMatch = rawPrice.match(/RM\s*[\d,]+\.\d{2}/);
        let price = priceMatch ? priceMatch[0] : rawPrice.replace(/\s+/g, ' ');
        
        let image = $(el).find('img').first().attr('src') || $(el).find('img').first().attr('data-src');
        
        if (name && price && link && !seenLinks.has(link)) {
            seenLinks.add(link);
            items.push({
                name,
                price: price.substring(0, 15).trim(),
                image: image && image.startsWith('//') ? 'https:' + image : image,
                link: link && link.startsWith('/') ? 'https://www.al-ikhsan.com' + link : link,
                source: 'Al-Ikhsan'
            });
        }
    });
    return items;
};

// --- Logik Ekstrak Sports Direct ---
const sportsDirectLogic = ($, limit) => {
    const items = [];
    const seenLinks = new Set();
    // Gunakan wildcard selector [class*="..."] untuk elakkan masalah hash class berubah (__D_8u5 vs __bgLcR)
    $('[class*="ProductCard_wrapper"], .ProductCard_wrapper__bgLcR, .s-productthumb').each((i, el) => {
        if (items.length >= limit) return false;
        
        let rawName = $(el).find('[class*="ProductCard_description"], .product-description').first().text().trim();
        let brand = $(el).find('[data-testid="product-card-brand"], [class*="ProductCard_brand"]').first().text().trim();
        let name = brand ? `${brand} ${rawName}` : rawName;
        
        let rawPrice = $(el).find('[class*="Price_root"], .Price_isDiscounted__lHTCZ, .product-price').first().text();
        
        // Ambil harga yang pertama (biasanya harga selepas diskaun)
        const priceMatch = rawPrice.match(/RM\s*[\d,]+\.\d{2}/);
        let price = priceMatch ? priceMatch[0] : rawPrice;
        
        let image = $(el).find('img').first().attr('src');
        let link = $(el).find('a').first().attr('href');
        
        if (name && price && link) {
            if (!seenLinks.has(link)) {
                seenLinks.add(link);
                items.push({
                    name,
                    price,
                    image: image && image.startsWith('//') ? 'https:' + image : image,
                    link: link.startsWith('/') ? 'https://www.sportsdirect.com.my' + link : link,
                    source: 'Sports Direct'
                });
            }
        }
    });
    return items;
};

// --- Logik Ekstrak Original Classic ---
const originalClassicLogic = ($, limit) => {
    const items = [];
    const seenLinks = new Set();
    // Pilih salah satu selector sahaja untuk elak duplicate DOM (mobile vs desktop view)
    $('.products-col-item').each((i, el) => {
        if (items.length >= limit) return false;
        
        // Ambil text pertama sahaja untuk elakkan nama berganda "CAP CAP"
        let name = $(el).find('h3 a, .product-title').first().text().trim();
        let rawPrice = $(el).find('.new-price, .product-price').first().text();
        
        const priceMatch = rawPrice.match(/RM\s*[\d,]+\.\d{2}/);
        let price = priceMatch ? priceMatch[0] : rawPrice.replace(/\s+/g, '').replace('RM', 'RM ').trim();
        
        let link = $(el).find('a').first().attr('href');
        
        let image = $(el).find('img.next-image').first().attr('src');
        const srcset = $(el).find('img.next-image').first().attr('srcset');
        
        // Fix Next.js lazy loading image
        if (!image || image.startsWith('data:image') || image.includes('transparent')) {
            if (srcset) {
                image = srcset.split(',')[0].trim().split(' ')[0]; // Ambil URL pertama dari srcset
            }
        }
        if (!image) {
            image = $(el).find('img').first().attr('src');
        }
        
        if (name && price && price.includes('RM') && price.length > 4 && link) {
            if (!seenLinks.has(link)) {
                seenLinks.add(link);
                // Potong nama yang mungkin berganda (cth: "ADIDAS CAP ADIDAS CAP" -> ambil separuh pertama jika berulang)
                const halfLength = Math.floor(name.length / 2);
                if (name.length > 20 && name.substring(0, halfLength) === name.substring(halfLength)) {
                    name = name.substring(0, halfLength).trim();
                }
                
                items.push({
                    name,
                    price,
                    image: image && image.startsWith('//') ? 'https:' + image : image,
                    link: (link && link.startsWith('/') ? 'https://originalclassic.com.my' + link : link) + (link && !link.includes('?') && !link.endsWith('/') ? '/' : ''),
                    source: 'Original Classic'
                });
            }
        }
    });
    return items;
};


// ==========================================
// ADMIN ENDPOINTS (API USAGE)
// ==========================================
app.get('/api/admin/scraper-usage', async (req, res) => {
    try {
        const response = await axios.get(`https://api.scraperapi.com/account?api_key=${process.env.SCRAPER_API_KEY}`);
        res.json({
            status: 'Success',
            data: {
                requestCount: response.data.requestCount,
                requestLimit: response.data.requestLimit,
                concurrentRequests: response.data.concurrentRequests
            }
        });
    } catch (error) {
        res.status(500).json({ status: 'Error', message: 'Gagal dapatkan data ScraperAPI' });
    }
});

// Endpoint untuk memadam pengguna sepenuhnya (Firestore + Firebase Auth)
app.delete('/api/admin/users/:uid', async (req, res) => {
    const uid = req.params.uid;
    try {
        // 1. Padam dari Firebase Authentication (Ini selesaikan masalah "email already in use")
        await admin.auth().deleteUser(uid);
        
        // 2. Padam rekod dari Firestore
        await db.collection('users').doc(uid).delete();
        
        saveLog(`✅ Akaun pengguna (Auth & Firestore) dipadam: ${uid}`, 'success');
        res.json({ status: 'Success', message: 'Pengguna dipadam sepenuhnya' });
    } catch (error) {
        console.error('Error delete user:', error);
        res.status(500).json({ error: 'Gagal memadam pengguna', details: error.message });
    }
});

app.get('/search', async (req, res) => {
    const keyword = req.query.keyword;
    const limit = parseInt(req.query.limit) || 5;
    const excludeStore = req.query.excludeStore || ''; // cth: 'Al-Ikhsan'

    if (!keyword) {
        return res.status(400).json({ error: 'Sila masukkan kata kunci (contoh: ?keyword=kasut+nike)!' });
    }

    saveLog(`\n🔍 Memulakan Carian Selari untuk: "${keyword}" (Limit: ${limit}, Exclude: ${excludeStore})`, 'info');
    const encodedKeyword = encodeURIComponent(keyword);

    // Ambil tetapan kedai dari Firebase (Admin Store Toggle)
    let storesConfig = { alikhsan: true, sportsdirect: true, originalclassic: true };
    try {
        const docRef = await db.collection('settings').doc('store_status').get();
        if (docRef.exists) {
            storesConfig = docRef.data();
        }
    } catch (err) {
        console.error("Gagal baca setting kedai:", err);
    }

    // Hanya panggil fungsi carian jika kedai itu berstatus 'true' (Aktif) dan tidak di-exclude
    const scrapeTasks = [];
    
    if (storesConfig.alikhsan && excludeStore !== 'Al-Ikhsan') {
        scrapeTasks.push(scrapeStore('Al-Ikhsan', `https://al-ikhsan.com/search?options%5Bprefix%5D=last&q=${encodedKeyword}`, alIkhsanLogic, false, limit));
    } else {
        scrapeTasks.push(Promise.resolve([])); // Kembalikan array kosong jika kedai ditutup atau di-exclude
    }

    if (storesConfig.sportsdirect && excludeStore !== 'Sports Direct') {
        scrapeTasks.push(scrapeStore('Sports Direct', `https://www.sportsdirect.com.my/searchresults?descriptionfilter=${encodedKeyword}`, sportsDirectLogic, false, limit));
    } else {
        scrapeTasks.push(Promise.resolve([]));
    }

    if (storesConfig.originalclassic && excludeStore !== 'Original Classic') {
        // Normalisasi kata kunci khas untuk Original Classic:
        // Enjin carian mereka sensitif terhadap apostrophe (cth: "Mens" tak jumpa, tapi "Men's" jumpa)
        const ocKeyword = keyword
            .replace(/\bMens\b/gi, "Men's")
            .replace(/\bWomens\b/gi, "Women's")
            .replace(/\bKids\b/gi, "Kid's");
        const encodedOcKeyword = encodeURIComponent(ocKeyword);
        scrapeTasks.push(scrapeStore('Original Classic', `https://originalclassic.com.my/product/search?search=${encodedOcKeyword}`, originalClassicLogic, false, limit));
    } else {
        scrapeTasks.push(Promise.resolve([]));
    }

    // PROSES UTAMA: Jalankan kesemua tugas secara serentak
    const [alIkhsanResults, sportsDirectResults, originalClassicResults] = await Promise.all(scrapeTasks);

    // Satukan semua hasil carian
    const allResults = [...alIkhsanResults, ...sportsDirectResults, ...originalClassicResults];

    // Hantar respons ke Frontend
    res.json({
        status: 'Success',
        keyword: keyword,
        totalFound: allResults.length,
        data: allResults
    });
});

const PORT = process.env.PORT || 5000;
// --- FUNGSI PENGHANTARAN NOTIFIKASI ---

async function sendTelegramNotification(chatId, message) {
    if (!chatId) return console.log('❌ Gagal hantar: Tiada Chat ID.');
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    try {
        await axios.post(url, {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        });
        console.log(`✅ Notifikasi Telegram dihantar ke ${chatId}!`);
    } catch (error) {
        console.error('❌ Gagal hantar Telegram:', error.response?.data || error.message);
    }
}

// --- TELEGRAM POLLING (Dengar arahan /start dari user) ---
let lastUpdateId = 0;
async function pollTelegram() {
    if (!TELEGRAM_TOKEN) return;
    try {
        const res = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`);
        const updates = res.data.result;
        
        for (const update of updates) {
            lastUpdateId = update.update_id;
            const msg = update.message;
            
            if (msg && msg.text && msg.text.startsWith('/start ')) {
                const userId = msg.text.split(' ')[1]; // Extract User ID
                const chatId = msg.chat.id;
                
                console.log(`📥 Sambungan Telegram diterima untuk User ID: ${userId} (Chat ID: ${chatId})`);

                // Simpan Chat ID ke Firestore dalam koleksi 'users'
                await db.collection('users').doc(userId).set({
                    telegramChatId: chatId.toString(),
                    telegramConnectedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

                // Hantar mesej pengesahan kepada user di Telegram
                await sendTelegramNotification(chatId, "✅ <b>SportPrice Account Successfully Connected!</b>\n\nYou will now receive price drop alerts directly to your Telegram.");
            }
        }
    } catch (error) {
        // Abaikan error polling biasa (timeout dll)
    }
}
// Jalankan polling setiap 3 saat
setInterval(pollTelegram, 3000);

async function sendEmailNotification(toEmail, productName, currentPrice, link) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return console.log('❌ Gagal hantar Email: Sila set EMAIL_USER dan EMAIL_PASS di .env');
    }
    
    try {
        const mailOptions = {
            from: `"SportPrice Tracker" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject: `🚨 Price Drop Alert: ${productName}`,
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #2563eb;">Great News!</h2>
                    <p>The price for <strong>${productName}</strong> that you are tracking has dropped!</p>
                    <p style="font-size: 1.2rem; font-weight: bold; color: #ef4444;">Current Price: ${currentPrice}</p>
                    <a href="${link}" style="display: inline-block; padding: 10px 20px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px;">Buy Now</a>
                    <p style="font-size: 0.8rem; color: #999; margin-top: 20px;">You are receiving this email because you set a Price Alert on SportPrice Aggregator.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Notifikasi Email dihantar ke ${toEmail}!`);
    } catch (error) {
        console.error('❌ Ralat Nodemailer:', error.message);
    }
}

// --- FUNGSI BANTUAN LOG SYSTEM ---
async function saveLog(message, type = 'info') {
    console.log(message); // Kekalkan log di terminal
    try {
        await db.collection('system_logs').add({
            message: message.replace(/\[|\]/g, '').trim(), // buang simbol pelik jika ada
            type: type,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        // abaikan error jika gagal log
    }
}

// --- LOGIK PRICE ALERT & HISTORY CHECKER (BACKGROUND WORKER) ---

async function checkPriceAlerts() {
    saveLog('⏰ Memulakan Semakan Harga & Rekod Sejarah Automatik', 'info');
    try {
        // 1. Ambil semua alert AKTIF dan semua barang WATCHLIST
        const alertsSnapshot = await db.collection('price_alerts').where('status', '==', 'active').get();
        const watchlistSnapshot = await db.collection('watchlist').get();

        // 2. Susun dan Kumpulkan Produk Unik untuk Mengelakkan Carian Berulang
        const uniqueProducts = new Map();
        const activeAlerts = [];
        
        alertsSnapshot.forEach(doc => {
            const data = doc.data();
            activeAlerts.push({ ...data, docId: doc.id });
            if (!uniqueProducts.has(data.productName)) {
                uniqueProducts.set(data.productName, { source: data.source });
            }
        });

        watchlistSnapshot.forEach(doc => {
            const data = doc.data();
            if (!uniqueProducts.has(data.name)) {
                uniqueProducts.set(data.name, { source: data.source });
            }
        });

        if (uniqueProducts.size === 0) {
            saveLog('ℹ️ Tiada produk untuk dijejak buat masa ini.', 'warning');
            return;
        }

        saveLog(`⏳ Menyemak ${uniqueProducts.size} produk unik (melibatkan ${activeAlerts.length} alert aktif)...`, 'info');

        // 3. Jalankan Carian Harga (Satu per satu)
        for (const [name, info] of uniqueProducts) {
            try {
                saveLog(`🔍 Menyemak: ${name}`, 'info');

                let logicFunc = alIkhsanLogic;
                let searchUrl = `https://al-ikhsan.com/search?options%5Bprefix%5D=last&q=${encodeURIComponent(name)}`;
                
                if (info.source === 'Sports Direct') {
                    logicFunc = sportsDirectLogic;
                    searchUrl = `https://www.sportsdirect.com.my/searchresults?descriptionfilter=${encodeURIComponent(name)}`;
                } else if (info.source === 'Original Classic') {
                    logicFunc = originalClassicLogic;
                    searchUrl = `https://originalclassic.com.my/product/search?search=${encodeURIComponent(name)}`;
                }

                const results = await scrapeStore(info.source || 'History Checker', searchUrl, logicFunc, false);
                
                if (results && results.length > 0) {
                    const currentPriceRaw = results[0]?.price || '';
                    if (!currentPriceRaw) throw new Error("Gagal mengekstrak harga dari hasil carian.");

                    const currentPrice = parseFloat(currentPriceRaw.toString().replace(/[^\d.]/g, ''));
                    if (isNaN(currentPrice)) throw new Error("Format harga tidak sah: " + currentPriceRaw);
                    
                    // --- A. SIMPAN SEJARAH HARGA (Untuk Graf) ---
                    await db.collection('price_history').add({
                        productName: name,
                        productId: normalizeProductId(name),
                        price: currentPrice,
                        priceRaw: currentPriceRaw,
                        source: info.source || 'Unknown',
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    saveLog(`📈 Sejarah direkod: RM${currentPrice}`, 'success');

                    // --- B. SEMAK SEMUA ALERT YANG BERKAITAN DENGAN PRODUK INI ---
                    const relatedAlerts = activeAlerts.filter(a => a.productName === name);
                    for (const alert of relatedAlerts) {
                        const targetPrice = parseFloat(alert.targetPrice);
                        if (currentPrice <= targetPrice) {
                            saveLog(`🚨 ALERT DIPICU untuk ${name} (User: ${alert.userId})!`, 'alert');
                            await db.collection('price_alerts').doc(alert.docId).update({
                                status: 'triggered',
                                triggeredPrice: currentPriceRaw,
                                triggeredAt: admin.firestore.FieldValue.serverTimestamp()
                            });

                            await db.collection('notifications').add({
                                userId: alert.userId,
                                title: 'Price Dropped!',
                                message: `The product "${name}" is now priced at ${currentPriceRaw}!`,
                                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                                isRead: false
                            });

                            // --- C. HANTAR NOTIFIKASI SEBENAR (TELEGRAM/EMAIL) ---
                            const productUrl = alert.link || results[0]?.link || searchUrl;
                            const message = `🚨 <b>PRICE DROP!</b>\n\nProduct: <b>${name}</b>\nNew Price: <b>${currentPriceRaw}</b>\n\nHurry, buy now before stock runs out!\n🔗 <a href="${productUrl}">Click Here to Buy</a>`;

                            if (alert.method === 'telegram') {
                                const userDoc = await db.collection('users').doc(alert.userId).get();
                                if (userDoc.exists && userDoc.data().telegramChatId) {
                                    await sendTelegramNotification(userDoc.data().telegramChatId, message);
                                    saveLog(`📲 Notifikasi Telegram dihantar ke ${userDoc.data().telegramChatId}.`, 'success');
                                } else {
                                    saveLog(`⚠️ User ${alert.userId} pilih Telegram tapi belum connect akaun.`, 'warning');
                                }
                            } else {
                                const targetEmail = alert.userEmail || process.env.EMAIL_USER || 'admin@sportprice.com'; 
                                await sendEmailNotification(targetEmail, name, currentPriceRaw, alert.link);
                                saveLog(`📧 Notifikasi Email dihantar ke ${targetEmail}.`, 'success');
                            }
                        }
                    }
                } else {
                    saveLog(`⚠️ Produk ${name} tidak dijumpai di ${info.source || 'kedai'}.`, 'warning');
                }
            } catch (innerError) {
                saveLog(`❌ Ralat semasa menyemak ${name}: ${innerError.message}`, 'error');
            }
        }
        saveLog('✅ Semakan & Rakaman Selesai', 'info');
    } catch (error) {
        saveLog(`❌ Ralat Checker: ${error.message}`, 'error');
    }
}

// Jalankan semakan setiap 30 minit
const THIRTY_MINUTES = 30 * 60 * 1000;
setInterval(checkPriceAlerts, THIRTY_MINUTES);

// Jalankan sekali semasa server mula (untuk testing)
setTimeout(checkPriceAlerts, 5000);

// --- ENDPOINT AI VISION ---
app.post('/api/categorize-image', async (req, res) => {
    const { imageUrl, productName } = req.body;
    if (!imageUrl) return res.status(400).json({ error: 'Sila berikan URL gambar.' });

    try {
        // Download image data
        const imageResp = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(imageResp.data);
        const base64Image = imageBuffer.toString("base64");
        const mimeType = imageResp.headers['content-type'] || 'image/jpeg';
        
        const prompt = `You are a sports product categorizer. Look at this image of a product named "${productName}". Classify it strictly into ONLY ONE of these three categories: 'Footwear', 'Apparel', or 'Accessories'. If it is a bag or backpack, it is Accessories. If it is a shoe or boot, it is Footwear. Respond with ONLY the exact category name (1 word).`;
        
        const groqResponse = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            messages: [{
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
                ]
            }],
            max_tokens: 15,
            temperature: 0.1
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const responseText = groqResponse.data.choices[0].message.content.trim();
        
        let category = 'Others';
        if (responseText.includes('Footwear')) category = 'Footwear';
        else if (responseText.includes('Apparel')) category = 'Apparel';
        else if (responseText.includes('Accessories')) category = 'Accessories';

        console.log(`🤖 [AI VISION] Mengecam barang: "${productName}" -> Keputusan: ${category}`);

        res.json({ category });
    } catch (error) {
        console.error('AI Error:', error.message);
        res.status(500).json({ error: error.message || 'Gagal menganalisis gambar' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server Dynamic Multi-Source Scraper jalan di http://localhost:${PORT}`);
});
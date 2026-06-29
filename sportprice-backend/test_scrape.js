const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const API_KEY = process.env.SCRAPER_API_KEY;

async function testScrape(store, url, filename) {
    try {
        console.log(`Fetching ${store}...`);
        const res = await axios.get('http://api.scraperapi.com', {
            params: {
                api_key: API_KEY,
                url: url,
                country_code: 'my'
            },
            timeout: 90000
        });
        fs.writeFileSync(filename, res.data);
        console.log(`Saved ${store} to ${filename}`);
    } catch (e) {
        console.error(`Failed ${store}:`, e.message);
        if (e.response) console.error("Status:", e.response.status);
    }
}

testScrape('Sports Direct', 'https://www.sportsdirect.com.my/searchresults?descriptionfilter=adidas', 'sd.html');

const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('oc.html', 'utf-8');
const $ = cheerio.load(html);
const links = [];
$('.products-col-item a').each((i, el) => {
    links.push($(el).attr('href'));
});
console.log(links.slice(0, 5));

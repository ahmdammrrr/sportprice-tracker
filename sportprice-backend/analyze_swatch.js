const fs = require("fs");
const cheerio = require("cheerio");
const html = fs.readFileSync("./debug_apparel.html", "utf-8");
const $ = cheerio.load(html);

const oldResult = [];
$("div[data-testid='variant-selector-items'] button[data-testid='swatch-button-enabled']").each(function(i, el) {
    oldResult.push({ value: $(el).attr("value"), text: $(el).text().trim() });
});
console.log("Old selector result:", JSON.stringify(oldResult));

const allSwatch = [];
$("button[data-testid*='swatch-button']").each(function(i, el) {
    allSwatch.push({ testid: $(el).attr("data-testid"), value: $(el).attr("value"), text: $(el).text().trim().substring(0,20), ariaLabel: $(el).attr("aria-label") });
});
console.log("All swatch buttons:", JSON.stringify(allSwatch.slice(0,10)));

const sizeBtns = [];
$("button").each(function(i, el) {
    const txt = $(el).text().trim();
    if (/^(XXS|XS|S|M|L|XL|XXL|2XL|3XL)$/.test(txt)) {
        sizeBtns.push({ text: txt, testid: $(el).attr("data-testid"), value: $(el).attr("value"), ariaLabel: $(el).attr("aria-label"), disabled: $(el).attr("disabled"), cls: ($(el).attr("class")||"").substring(0,80) });
    }
});
console.log("Apparel size buttons:", JSON.stringify(sizeBtns));

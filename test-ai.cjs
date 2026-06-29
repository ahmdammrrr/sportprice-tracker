const axios = require('axios');

async function test() {
    try {
        const res = await axios.post('http://localhost:5000/api/categorize-image', {
            imageUrl: 'https://al-ikhsan.com/products/nike-tiempo-legend-10-club-men-s-futsal-blue-dv4343-402',
            productName: 'NIKE Tiempo Legend 10 Club Mens Futsal Blue DV4343-402'
        });
        console.log(res.data);
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
test();

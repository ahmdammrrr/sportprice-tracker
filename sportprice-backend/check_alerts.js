const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkAllAlerts() {
    console.log('--- 🔔 Semakan Koleksi Price Alerts ---');
    try {
        const alertsRef = db.collection('price_alerts');
        const snapshot = await alertsRef.get();

        if (snapshot.empty) {
            console.log('❌ Koleksi price_alerts adalah KOSONG.');
            return;
        }

        console.log(`✅ Dijumpai ${snapshot.size} alert(s) secara keseluruhan:`);
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`- Product: ${data.productName}`);
            console.log(`  User ID: ${data.userId}`);
            console.log(`  Email: ${data.userEmail || 'N/A'}`);
            console.log(`  Status: ${data.status}`);
            console.log('---------------------------');
        });

    } catch (error) {
        console.error('Error:', error);
    }
}

checkAllAlerts();

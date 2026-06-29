const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkUsers() {
    const snapshot = await db.collection('users').get();
    if (snapshot.empty) {
        console.log('No users found.');
        return;
    }
    
    snapshot.forEach(doc => {
        console.log(doc.id, '=>', doc.data());
    });
}

checkUsers();

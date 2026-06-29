const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkUser(email) {
    console.log(`Checking Firebase for email: ${email}`);
    
    // Check Auth
    let authUser = null;
    try {
        authUser = await admin.auth().getUserByEmail(email);
        console.log(`✅ User found in Firebase Auth:`);
        console.log(`   UID: ${authUser.uid}`);
        console.log(`   Creation Time: ${authUser.metadata.creationTime}`);
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            console.log(`❌ User NOT found in Firebase Auth.`);
        } else {
            console.error(`Error checking Auth:`, error.message);
        }
    }

    // Check Firestore
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', email).get();
        if (snapshot.empty) {
            console.log(`❌ User NOT found in Firestore 'users' collection.`);
        } else {
            console.log(`✅ User found in Firestore 'users' collection:`);
            snapshot.forEach(doc => {
                console.log(`   Doc ID: ${doc.id} =>`, JSON.stringify(doc.data(), null, 2));
            });
        }
    } catch (error) {
        console.error(`Error checking Firestore:`, error.message);
    }
    process.exit(0);
}

checkUser('ashitah.othman@gmail.com');

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteUser(email) {
    console.log(`Attempting to delete email: ${email}`);
    
    try {
        const authUser = await admin.auth().getUserByEmail(email);
        await admin.auth().deleteUser(authUser.uid);
        console.log(`✅ Successfully deleted user from Firebase Auth! (UID: ${authUser.uid})`);
    } catch (error) {
        console.error(`❌ Error deleting from Auth:`, error.message);
    }
    
    process.exit(0);
}

deleteUser('ashitah.othman@gmail.com');

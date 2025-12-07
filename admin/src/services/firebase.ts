import * as admin from 'firebase-admin'
import * as path from 'path';

const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');

if (!admin.apps.length) {
  try {
    admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
    databaseURL: "https://medbox-1a654-default-rtdb.europe-west1.firebasedatabase.app"
});
    console.log('Firebase Admin Initialized');
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error);
  }
}

export const db = admin.firestore();
export const auth = admin.auth();
export const rtdb = admin.database();
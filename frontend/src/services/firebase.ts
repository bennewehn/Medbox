import { initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth'
import { Database, getDatabase } from 'firebase/database';
import { getFirestore, Firestore } from 'firebase/firestore'; 

let auth: Auth | undefined;
let firestore: Firestore | undefined;
let db: Database;
let appId = 'default-app-id';
let initializationError: Error | null = null;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
};

try {
  if (!firebaseConfig.apiKey) {
     throw new Error("Firebase API Key is missing. Check your .env file.");
  }

  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  firestore = getFirestore(app);
  db = getDatabase(app);
  appId = firebaseConfig.appId || 'default-app-id';

} catch (err: any) {
  console.error("CRITICAL: Firebase Initialization Failed", err);
  initializationError = err;
}

export { auth, firestore, db, appId, initializationError };
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const isConfigValid = !!(
  firebaseConfig && 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey.length > 10 &&
  !firebaseConfig.apiKey.includes('REPLACE_WITH')
);

let app;
if (isConfigValid) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  } catch (err) {
    console.error('Firebase initialization failure:', err);
  }
}

export const db = app ? (
  (firebaseConfig as any).firestoreDatabaseId && (firebaseConfig as any).firestoreDatabaseId !== "(default)" 
    ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId) 
    : getFirestore(app)
) : null;

export const auth = app ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();

if (!isConfigValid) {
  console.warn('Firebase configuration is missing or contains placeholder values. Authentication and Database features will be disabled. Please configure Firebase in the Settings menu.');
}

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

/**
 * Firebase Admin Initializer
 * This module handles the initialization of the Firebase Admin SDK.
 * It first attempts to use a service account JSON file if FIREBASE_SERVICE_ACCOUNT is set,
 * then falls back to project ID from firebase-applet-config.json or environment variables.
 */

if (!admin.apps.length) {
  let projectId: string | undefined = undefined;
  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');

  // Load config if it exists to get the Project ID
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.projectId) {
        projectId = config.projectId;
      }
    } catch (err) {
      console.warn('Error reading firebase-applet-config.json:', err);
    }
  }

  try {
    if (serviceAccountVar && !serviceAccountVar.includes('REPLACE_WITH')) {
      // Priority 1: Full Service Account from environment
      const serviceAccount = JSON.parse(serviceAccountVar);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId
      });
      console.log('Firebase Admin initialized with service account from environment.');
    } else if (projectId && !projectId.includes('REPLACE_WITH') && projectId !== 'missing') {
      // Priority 2: Project ID for default credentials (works in Cloud environments)
      admin.initializeApp({
        projectId: projectId
      });
      console.log('Firebase Admin initialized with Project ID:', projectId);
    } else {
      console.warn('Firebase Admin could not be initialized. Missing Project ID or Service Account. Authentication features will be disabled.');
    }
  } catch (err) {
    console.error('Firebase Admin initialization failure:', err);
  }
}

// Export lazy getters or handle nulls to prevent crashes on routes that import these
export const getAdminAuth = () => {
  try {
    return admin.apps.length > 0 ? admin.auth() : null;
  } catch (e) {
    return null;
  }
};

export const getAdminDb = () => {
  try {
    return admin.apps.length > 0 ? admin.firestore() : null;
  } catch (e) {
    return null;
  }
};

// For backward compatibility but safer
export const adminAuth = admin.apps.length > 0 ? admin.auth() : null;
export const adminDb = admin.apps.length > 0 ? admin.firestore() : null;

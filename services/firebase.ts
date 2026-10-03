import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, Functions } from 'firebase/functions';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAnalytics, Analytics } from 'firebase/analytics';
import { connectFunctionsEmulatorIfConfigured } from './functionsEmulatorMode';

// Firebase web configuration is intentionally browser-visible. It is not a
// provider secret, but the Web API key must be restricted in Google Cloud and
// all data access must be enforced by Firestore Security Rules.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ''
};

// Initialize Firebase variables
let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;
let googleProvider: GoogleAuthProvider | undefined;
let analytics: Analytics | undefined;
let functions: Functions | undefined;
let storage: FirebaseStorage | undefined;
let initializationError: string | null = null;

try {
    if (typeof window !== 'undefined') {
        const hasRequiredConfig = Boolean(
          firebaseConfig.apiKey &&
          firebaseConfig.authDomain &&
          firebaseConfig.projectId &&
          firebaseConfig.appId
        );

        if (!hasRequiredConfig) {
          initializationError = 'Firebase web configuration is missing. Copy .env.example to .env.local and provide only the public Firebase web configuration.';
        }

        // Initialize App
        try {
            if (hasRequiredConfig) {
                if (!getApps().length) {
                    app = initializeApp(firebaseConfig);
                } else {
                    app = getApp();
                }
            }
        } catch (appError: any) {
            console.error("Firebase App init failed:", appError);
            initializationError = appError.message || "App init failed";
        }

        if (app) {
            // Initialize Analytics safely
            try {
                analytics = getAnalytics(app);
            } catch (analyticsError) {
                 console.log("Analytics not supported in this environment");
            }

            // Initialize Firestore
            try {
                db = getFirestore(app);
                console.log("✅ Firebase Firestore initialized");
            } catch (dbError: any) {
                console.warn("Firebase Firestore init failed:", dbError);
                initializationError = dbError.message || "Firestore init failed";
            }

            // Initialize Auth
            try {
                auth = getAuth(app);
                googleProvider = new GoogleAuthProvider();
                console.log("✅ Firebase Auth initialized");
            } catch (authError: any) {
                console.warn("Firebase Auth init failed:", authError);
                if (!initializationError) initializationError = authError.message || "Auth init failed";
            }

            try {
                const candidateFunctions = getFunctions(app, 'europe-west1');
                connectFunctionsEmulatorIfConfigured(candidateFunctions, {
                  DEV: import.meta.env.DEV,
                  VITE_USE_FUNCTIONS_EMULATOR: import.meta.env.VITE_USE_FUNCTIONS_EMULATOR,
                  VITE_FUNCTIONS_EMULATOR_HOST: import.meta.env.VITE_FUNCTIONS_EMULATOR_HOST,
                  VITE_FUNCTIONS_EMULATOR_PORT: import.meta.env.VITE_FUNCTIONS_EMULATOR_PORT
                }, connectFunctionsEmulator);
                functions = candidateFunctions;
            } catch (functionsError: any) {
                console.warn("Firebase Functions init failed:", functionsError);
                if (!initializationError) initializationError = functionsError.message || "Functions init failed";
            }
            try {
                storage = getStorage(app);
            } catch (storageError: any) {
                console.warn('Firebase Storage init failed:', storageError);
                if (!initializationError) initializationError = storageError.message || 'Storage init failed';
            }
        }
    }
} catch (e: any) {
    console.error("❌ Firebase Initialization Error:", e.message);
    initializationError = e.message;
}

export { db, auth, googleProvider, analytics, functions, storage, initializationError };

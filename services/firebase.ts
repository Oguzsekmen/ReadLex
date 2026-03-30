import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getAnalytics, Analytics } from 'firebase/analytics';

// Configuration provided by user
const firebaseConfig = {
  apiKey: "AIzaSyBIsMET8iCQWTlr_CSoD98PC6Zr3_xIuSg",
  authDomain: "readlex-app-c1912.firebaseapp.com",
  projectId: "readlex-app-c1912",
  storageBucket: "readlex-app-c1912.firebasestorage.app",
  messagingSenderId: "301728087460",
  appId: "1:301728087460:web:8fe220800b79f0a876d531",
  measurementId: "G-CVP8LFCSWE"
};

// Initialize Firebase variables
let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;
let googleProvider: GoogleAuthProvider | undefined;
let analytics: Analytics | undefined;
let initializationError: string | null = null;

try {
    if (typeof window !== 'undefined') {
        // Initialize App
        try {
            if (!getApps().length) {
                app = initializeApp(firebaseConfig);
            } else {
                app = getApp();
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
        }
    }
} catch (e: any) {
    console.error("❌ Firebase Initialization Error:", e.message);
    initializationError = e.message;
}

export { db, auth, googleProvider, analytics, initializationError };
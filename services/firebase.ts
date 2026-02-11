import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';
import 'firebase/compat/analytics';

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
let app: firebase.app.App | undefined;
let db: firebase.firestore.Firestore | undefined;
let auth: firebase.auth.Auth | undefined;
let googleProvider: firebase.auth.GoogleAuthProvider | undefined;
let analytics: firebase.analytics.Analytics | undefined;

try {
    if (typeof window !== 'undefined') {
        if (!firebase.apps.length) {
            app = firebase.initializeApp(firebaseConfig);
        } else {
            app = firebase.app();
        }

        // Initialize Analytics safely
        try {
            analytics = firebase.analytics();
        } catch (analyticsError) {
             console.log("Analytics not supported in this environment");
        }

        // Initialize services individually to isolate failures
        try {
            db = firebase.firestore();
            console.log("✅ Firebase Firestore initialized");
        } catch (dbError) {
            console.warn("Firebase Firestore init failed:", dbError);
        }

        try {
            auth = firebase.auth();
            googleProvider = new firebase.auth.GoogleAuthProvider();
            console.log("✅ Firebase Auth initialized");
        } catch (authError) {
            console.warn("Firebase Auth init failed:", authError);
        }
    }
} catch (e: any) {
    console.error("❌ Firebase Initialization Error:", e.message);
}

export { db, auth, googleProvider, analytics };
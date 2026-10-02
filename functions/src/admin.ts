import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Cloud Functions uses runtime Application Default Credentials. Local scripts
// use the owner's ADC or GOOGLE_APPLICATION_CREDENTIALS outside this repository.
if (!getApps().length) initializeApp();

export const adminAuth = getAuth();
export const adminDb = getFirestore();
export const adminStorage = getStorage();

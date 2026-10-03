import { HttpsError } from 'firebase-functions/v2/https';

type Environment = Record<string, string | undefined>;

export const isLocalHybridMode = (environment: Environment = process.env): boolean =>
  environment.READLEX_LOCAL_HYBRID === 'true';

/**
 * A local Functions process running in hybrid mode is allowed to use live Auth
 * tokens, but its Admin SDK must never fall back to production data services.
 */
export const assertHybridLocalEmulatorSafety = (environment: Environment = process.env): void => {
  if (!isLocalHybridMode(environment)) return;

  const missing: string[] = [];
  if (!environment.FIRESTORE_EMULATOR_HOST) missing.push('FIRESTORE_EMULATOR_HOST');
  // Firebase CLI supplies FIREBASE_STORAGE_EMULATOR_HOST. STORAGE_EMULATOR_HOST
  // is accepted because firebase-admin also honors it in local test harnesses.
  if (!environment.FIREBASE_STORAGE_EMULATOR_HOST && !environment.STORAGE_EMULATOR_HOST) {
    missing.push('FIREBASE_STORAGE_EMULATOR_HOST');
  }

  if (missing.length) {
    throw new Error(
      `READLEX_LOCAL_HYBRID requires ${missing.join(' and ')}. Local Admin SDK startup was blocked to prevent production writes.`,
    );
  }
};

/** Real OCR and Translation provider clients are intentionally unavailable in hybrid manual testing. */
export const assertExternalProviderExecutionAllowed = (
  provider: 'OCR' | 'Translation',
  environment: Environment = process.env,
): void => {
  if (isLocalHybridMode(environment)) {
    throw new HttpsError(
      'failed-precondition',
      `${provider} cloud provider calls are disabled while READLEX_LOCAL_HYBRID is enabled.`,
    );
  }
};

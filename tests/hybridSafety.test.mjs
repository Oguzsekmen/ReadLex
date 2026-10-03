import assert from 'node:assert/strict';
import { test } from 'node:test';

const { assertExternalProviderExecutionAllowed, assertHybridLocalEmulatorSafety } = await import('../functions/lib/hybridSafety.js');
const { getOcrProvider } = await import('../functions/lib/ocr/provider.js');
const { getTranslationProvider } = await import('../functions/lib/translation/provider.js');

const hybrid = {
  READLEX_LOCAL_HYBRID: 'true',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
};

test('hybrid mode blocks Admin SDK startup without local Firestore and Storage hosts', () => {
  assert.throws(
    () => assertHybridLocalEmulatorSafety({ READLEX_LOCAL_HYBRID: 'true' }),
    /FIRESTORE_EMULATOR_HOST.*FIREBASE_STORAGE_EMULATOR_HOST/,
  );
  assert.throws(
    () => assertHybridLocalEmulatorSafety({ READLEX_LOCAL_HYBRID: 'true', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }),
    /FIREBASE_STORAGE_EMULATOR_HOST/,
  );
  assert.doesNotThrow(() => assertHybridLocalEmulatorSafety(hybrid));
});

test('non-hybrid mode keeps the existing provider behavior available', () => {
  assert.doesNotThrow(() => assertHybridLocalEmulatorSafety({}));
  assert.doesNotThrow(() => assertExternalProviderExecutionAllowed('OCR', {}));
  assert.doesNotThrow(() => assertExternalProviderExecutionAllowed('Translation', {}));
});

test('hybrid mode blocks real OCR and Translation provider selection before a cloud call', () => {
  const previous = process.env.READLEX_LOCAL_HYBRID;
  process.env.READLEX_LOCAL_HYBRID = 'true';
  try {
    assert.throws(() => getOcrProvider(), error => error?.code === 'failed-precondition');
    assert.throws(() => getTranslationProvider(), error => error?.code === 'failed-precondition');
  } finally {
    if (previous === undefined) delete process.env.READLEX_LOCAL_HYBRID;
    else process.env.READLEX_LOCAL_HYBRID = previous;
  }
});

// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { SecureStorageUnavailableError, clearOwnedSecureStorage, secureStorage } from '../services/native/secureStorage';

describe('secure storage boundary', () => {
  beforeEach(() => localStorage.clear());

  it('is explicitly unavailable and never falls back to localStorage for sensitive values', async () => {
    await expect(secureStorage.set('future-sensitive-key', 'value')).rejects.toBeInstanceOf(SecureStorageUnavailableError);
    await expect(secureStorage.get('future-sensitive-key')).rejects.toBeInstanceOf(SecureStorageUnavailableError);
    expect(localStorage.getItem('future-sensitive-key')).toBeNull();
    expect(secureStorage.status).toBe('NOT_CONFIGURED');
  });

  it('clears only app-owned secure keys, leaving browser preferences untouched', async () => {
    localStorage.setItem('reader-font-size', '19');
    await clearOwnedSecureStorage();
    expect(localStorage.getItem('reader-font-size')).toBe('19');
  });
});

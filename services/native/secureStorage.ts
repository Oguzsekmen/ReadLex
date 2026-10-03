export type SecureStorageStatus = 'NOT_CONFIGURED';

export type SecureStorageAdapter = {
  readonly status: SecureStorageStatus;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  clearOwnedKeys(): Promise<void>;
};

export class SecureStorageUnavailableError extends Error {
  constructor() {
    super('Secure storage is not configured for this app.');
    this.name = 'SecureStorageUnavailableError';
  }
}

// ReadLex currently owns no app-specific sensitive values. Firebase Auth owns
// its own session persistence, and its tokens must never be copied here. This
// boundary deliberately does not downgrade values to localStorage.
const unavailable = (): never => {
  throw new SecureStorageUnavailableError();
};

export const secureStorage: SecureStorageAdapter = {
  status: 'NOT_CONFIGURED',
  async get(_key) { return unavailable(); },
  async set(_key, _value) { return unavailable(); },
  async remove(_key) { return unavailable(); },
  async clearOwnedKeys() {
    // There are no app-owned secure keys in this phase. Do not clear browser
    // preferences or Firebase-managed persistence as part of logout.
  },
};

export const clearOwnedSecureStorage = () => secureStorage.clearOwnedKeys();

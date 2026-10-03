import { describe, expect, it } from 'vitest';
import { normalizeAppPlatform } from '../services/native/platform';

describe('native platform helper', () => {
  it('normalizes supported Capacitor platforms and fails unknown values closed to web', () => {
    expect(normalizeAppPlatform('web')).toBe('web');
    expect(normalizeAppPlatform('android')).toBe('android');
    expect(normalizeAppPlatform('ios')).toBe('ios');
    expect(normalizeAppPlatform('desktop')).toBe('web');
    expect(normalizeAppPlatform(undefined)).toBe('web');
  });
});

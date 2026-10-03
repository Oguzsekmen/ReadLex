import { Capacitor } from '@capacitor/core';

export type AppPlatform = 'web' | 'android' | 'ios';

export const normalizeAppPlatform = (value: unknown): AppPlatform =>
  value === 'android' || value === 'ios' ? value : 'web';

// Keep Capacitor platform detection in one place. Components should not infer
// native runtime state from user-agent strings or window globals.
export const getAppPlatform = (): AppPlatform =>
  normalizeAppPlatform(Capacitor.getPlatform?.());

export const isNativePlatform = (): boolean => getAppPlatform() !== 'web';

import { describe, expect, it } from 'vitest';
import config from '../capacitor.config';

describe('Capacitor mobile baseline', () => {
  it('uses a stable package identity and the local production bundle', () => {
    expect(config.appId).toBe('io.github.oguzsekmen.readlex');
    expect(config.appName).toBe('ReadLex');
    expect(config.webDir).toBe('dist');
  });

  it('does not configure a remote development server for packaged apps', () => {
    expect(config.server).toBeUndefined();
  });
});

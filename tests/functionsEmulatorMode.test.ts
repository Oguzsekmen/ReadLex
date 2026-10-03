import { describe, expect, it, vi } from 'vitest';
import {
  connectFunctionsEmulatorIfConfigured,
  resolveFunctionsEmulatorConfig,
} from '../services/functionsEmulatorMode';

const developmentEnvironment = {
  DEV: true,
  VITE_USE_FUNCTIONS_EMULATOR: 'true',
  VITE_FUNCTIONS_EMULATOR_HOST: '127.0.0.1',
  VITE_FUNCTIONS_EMULATOR_PORT: '5001',
};

describe('Functions-only emulator mode', () => {
  it('is disabled by default and never connects a Functions client', () => {
    const connect = vi.fn();
    const result = connectFunctionsEmulatorIfConfigured({}, { DEV: true }, connect);
    expect(result).toBeUndefined();
    expect(connect).not.toHaveBeenCalled();
  });

  it('connects only the supplied Functions client for an explicit DEV opt-in', () => {
    const functionsClient = {};
    const connect = vi.fn();
    const result = connectFunctionsEmulatorIfConfigured(functionsClient, developmentEnvironment, connect);
    expect(result).toEqual({ host: '127.0.0.1', port: 5001 });
    expect(connect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledWith(functionsClient, '127.0.0.1', 5001);
  });

  it('never enables localhost Functions in a production build', () => {
    const connect = vi.fn();
    const result = connectFunctionsEmulatorIfConfigured({}, { ...developmentEnvironment, DEV: false }, connect);
    expect(result).toBeUndefined();
    expect(connect).not.toHaveBeenCalled();
  });

  it('accepts localhost and defaults safely when host and port are omitted', () => {
    expect(resolveFunctionsEmulatorConfig({ DEV: true, VITE_USE_FUNCTIONS_EMULATOR: 'true' }))
      .toEqual({ host: '127.0.0.1', port: 5001 });
    expect(resolveFunctionsEmulatorConfig({ ...developmentEnvironment, VITE_FUNCTIONS_EMULATOR_HOST: 'localhost' }))
      .toEqual({ host: 'localhost', port: 5001 });
  });

  it('rejects non-loopback hosts and invalid ports before any connection', () => {
    expect(() => resolveFunctionsEmulatorConfig({ ...developmentEnvironment, VITE_FUNCTIONS_EMULATOR_HOST: '192.168.1.10' }))
      .toThrow('localhost or 127.0.0.1');
    expect(() => resolveFunctionsEmulatorConfig({ ...developmentEnvironment, VITE_FUNCTIONS_EMULATOR_PORT: '0' }))
      .toThrow('valid TCP port');
  });
});

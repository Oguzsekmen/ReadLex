export interface FunctionsEmulatorConfig {
  host: '127.0.0.1' | 'localhost';
  port: number;
}

export interface FunctionsEmulatorEnvironment {
  DEV: boolean;
  VITE_USE_FUNCTIONS_EMULATOR?: string;
  VITE_FUNCTIONS_EMULATOR_HOST?: string;
  VITE_FUNCTIONS_EMULATOR_PORT?: string;
}

const LOOPBACK_HOSTS = new Set<FunctionsEmulatorConfig['host']>(['127.0.0.1', 'localhost']);
const DEFAULT_HOST: FunctionsEmulatorConfig['host'] = '127.0.0.1';
const DEFAULT_PORT = 5001;

/**
 * Returns a Functions-only emulator configuration for an explicit local dev
 * opt-in. Auth, Firestore, and Storage are deliberately outside this boundary.
 */
export const resolveFunctionsEmulatorConfig = (
  environment: FunctionsEmulatorEnvironment,
): FunctionsEmulatorConfig | undefined => {
  if (!environment.DEV || environment.VITE_USE_FUNCTIONS_EMULATOR !== 'true') {
    return undefined;
  }

  const requestedHost = environment.VITE_FUNCTIONS_EMULATOR_HOST || DEFAULT_HOST;
  if (!LOOPBACK_HOSTS.has(requestedHost as FunctionsEmulatorConfig['host'])) {
    throw new Error('Functions emulator host must be localhost or 127.0.0.1 in hybrid local mode.');
  }

  const requestedPort = environment.VITE_FUNCTIONS_EMULATOR_PORT || String(DEFAULT_PORT);
  const port = Number(requestedPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Functions emulator port must be a valid TCP port in hybrid local mode.');
  }

  return { host: requestedHost as FunctionsEmulatorConfig['host'], port };
};

export const connectFunctionsEmulatorIfConfigured = <T>(
  functions: T,
  environment: FunctionsEmulatorEnvironment,
  connect: (instance: T, host: string, port: number) => void,
): FunctionsEmulatorConfig | undefined => {
  const configuration = resolveFunctionsEmulatorConfig(environment);
  if (configuration) {
    connect(functions, configuration.host, configuration.port);
  }
  return configuration;
};

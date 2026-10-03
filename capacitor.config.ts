import type { CapacitorConfig } from '@capacitor/cli';

// Native shells always load the local Vite production bundle in `dist`.
// There is deliberately no `server.url` here: a packaged build must not
// depend on a development server or a remote web host.
const config: CapacitorConfig = {
  appId: 'io.github.oguzsekmen.readlex',
  appName: 'ReadLex',
  webDir: 'dist',
};

export default config;

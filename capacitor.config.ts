import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.oracleboxing.app',
  appName: 'Oracle Boxing',
  webDir: 'native/www',
  ios: {
    contentInset: 'automatic',
  },
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith('http://'),
        },
      }
    : {}),
};

export default config;

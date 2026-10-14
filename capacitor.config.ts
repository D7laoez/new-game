import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.partygames.collection',
  appName: 'Party Game Collection',
  webDir: 'dist',
  server: {
    // In production the WebView loads local dist/ assets (offline). No server url.
    androidScheme: 'https'
  },
  android: {
    backgroundColor: '#0a0c16',
    // Splash handled via core splash screen plugin settings if added later
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0a0c16'
    }
  }
};

export default config;

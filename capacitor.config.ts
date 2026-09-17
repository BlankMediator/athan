import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.athan.companion',
  appName: 'Athan',
  webDir: 'mobile-ui',
  backgroundColor: '#f6f7f2',
  android: { allowMixedContent: false, minWebViewVersion: 120 },
  ios: { contentInset: 'never', preferredContentMode: 'mobile' },
  plugins: {
    LocalNotifications: { smallIcon: 'ic_stat_athan', iconColor: '#355e4d', presentationOptions: ['banner', 'list'] },
  },
};
export default config;

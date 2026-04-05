import { Capacitor } from '@capacitor/core';
import { AdMob } from '@capacitor-community/admob';

async function initAds() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AdMob.initialize({
      initializeForTesting: true,
    });
  } catch (e) {
    console.warn('[AdMob] init failed', e);
  }
}

initAds();

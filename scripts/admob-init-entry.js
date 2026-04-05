import { Capacitor } from '@capacitor/core';
import { AdMob } from '@capacitor-community/admob';

/** 換成你在 AdMob 後台建立的「插頁式」廣告單元 ID（格式 ca-app-pub-xxx/yyy）。 */
const INTERSTITIAL_AD_ID = 'ca-app-pub-8018574520708301/8085817309';

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

/**
 * 顯示插頁式廣告（先 prepare 再 show）。僅在原生 App 有效；瀏覽器內為 no-op。
 * 從遊戲邏輯呼叫：if (window.showInterstitialAd) window.showInterstitialAd();
 */
async function showInterstitialAd() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AdMob.prepareInterstitial({
      adId: INTERSTITIAL_AD_ID,
      isTesting: true,
    });
    await AdMob.showInterstitial();
  } catch (e) {
    console.warn('[AdMob] interstitial failed', e);
  }
}

window.showInterstitialAd = showInterstitialAd;

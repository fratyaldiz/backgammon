import * as Haptics from 'expo-haptics';

let enabled = true;

export function setHapticsEnabled(v) {
  enabled = !!v;
}

// Titreşim desteklenmeyen cihazlarda sessizce yok sayılır.
function safe(fn) {
  if (!enabled) return;
  try { fn(); } catch (e) { /* yoksay */ }
}

export const haptics = {
  // Taş yerleştirme
  move: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  // Zar atma
  roll: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  // Taş kırma / kırılma
  hit: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  // Taş toplama
  bearOff: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  // Oyun kazanıldı
  win: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  // Oyun kaybedildi
  lose: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  // Buton dokunuşu
  tap: () => safe(() => Haptics.selectionAsync()),
};

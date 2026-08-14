/**
 * Cihazdan cihaza tutarlı ölçekleme.
 *
 * Oyun yatay modda çalışır, bu yüzden belirleyici ölçü ekranın kısa
 * kenarıdır (yükseklik). Tipografi ve boşluklar bu orana bağlanır; böylece
 * küçük telefonda taşma, tablette devasa boşluk oluşmaz.
 */

// iPhone 12/13/14 yatay yüksekliği referans alınır
const BASE_SHORT_SIDE = 390;

export function makeScale(width, height) {
  const shortSide = Math.min(width, height);
  // Aşırı büyümeyi ve küçülmeyi sınırla
  const raw = shortSide / BASE_SHORT_SIDE;
  const factor = Math.max(0.78, Math.min(1.45, raw));

  /** Ölçeklenmiş piksel değeri (yuvarlanmış). */
  const s = (n) => Math.round(n * factor);

  return { factor, s, shortSide, longSide: Math.max(width, height) };
}

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

/**
 * Oyun içi para ekonomisi.
 *
 * Her masanın sabit bir bahsi vardır ve zorluk seviyesiyle eşleşir: güçlü
 * rakip = yüksek bahis = yüksek kazanç. Kazanan bahsi alır, mars olursa
 * iki katı. Mars kaybı da iki kat olduğu için masaya girmek bahsin iki
 * katı bakiye ister; böylece bakiye hiçbir zaman eksiye düşmez.
 */

export const STARTING_BALANCE = 5000;

// Altı saatte bir verilen ödül. Şampiyon masasına girmeye yeter, yani
// bakiyesi biten oyuncu beklediğinde en zor modda tekrar oynayabilir.
export const BONUS_AMOUNT = 5000;
export const BONUS_INTERVAL_MS = 6 * 60 * 60 * 1000;

export const TABLES = [
  { id: 'easy', name: 'Acemi Masası', bet: 250, difficulty: 'easy', desc: 'Rastgele hamleler' },
  { id: 'medium', name: 'Usta Masası', bet: 1000, difficulty: 'medium', desc: '' },
  { id: 'hard', name: 'Şampiyon Masası', bet: 2500, difficulty: 'hard', desc: '' },
];

/**
 * Oyun içi bahis katlama. Sıradaki taraf, zar atmadan önce bahsi iki katına
 * çıkarmayı önerebilir. Karşı taraf kabul ederse çarpan ikiye katlanır ve
 * katlama hakkı ona geçer; reddederse oyunu o anki değerinden kaybeder.
 *
 * Tavladaki çift değer küpünün kuralı budur; katlama hakkının el değiştirmesi
 * sınırsız katlamayı engeller.
 */
export const MAX_MULTIPLIER = 8;

export function nextMultiplier(current) {
  return Math.min(current * 2, MAX_MULTIPLIER);
}

export function canOfferRaise(multiplier, cubeOwner, side) {
  if (multiplier >= MAX_MULTIPLIER) return false;
  // Küp ortadaysa iki taraf da önerebilir; sahibi varsa yalnızca sahibi
  return cubeOwner === null || cubeOwner === side;
}

/** Katlama önerisi için gereken bakiye (mars riski dahil). */
export function balanceForRaise(bet, currentMultiplier) {
  return bet * nextMultiplier(currentMultiplier) * 2;
}

export function getTable(id) {
  return TABLES.find(t => t.id === id) || TABLES[0];
}

/** Mars kaybını da karşılayabilmek için gereken en düşük bakiye. */
export function minBalanceFor(table) {
  return table.bet * 2;
}

export function canPlay(balance, table) {
  return balance >= minBalanceFor(table);
}


/**
 * Oyun sonucunun bakiyeye etkisi.
 * points: 1 (normal) veya 2 (mars)
 */
export function settlement(bet, points, playerWon, multiplier = 1) {
  const value = bet * points * multiplier;
  return playerWon ? value : -value;
}

/** Yarıda bırakılan oyun normal yenilgi sayılır. */
export function forfeitAmount(bet, multiplier = 1) {
  return -bet * multiplier;
}

// ─── Ödül sayacı ─────────────────────────────────
export function bonusStatus(lastBonusAt, now = Date.now()) {
  if (!lastBonusAt) return { ready: true, remainingMs: 0 };
  const elapsed = now - lastBonusAt;
  if (elapsed >= BONUS_INTERVAL_MS) return { ready: true, remainingMs: 0 };
  return { ready: false, remainingMs: BONUS_INTERVAL_MS - elapsed };
}

export function formatRemaining(ms) {
  if (ms <= 0) return '00:00:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}

/** Para miktarını okunur biçimde gösterir (1.250 gibi). */
export function formatCoins(n) {
  return Math.round(n).toLocaleString('tr-TR');
}

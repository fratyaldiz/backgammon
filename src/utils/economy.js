/**
 * Oyun içi para ekonomisi.
 *
 * Her masanın sabit bir bahsi vardır ve zorluk seviyesiyle eşleşir: güçlü
 * rakip = yüksek bahis = yüksek kazanç. Kazanan bahsi alır, mars olursa
 * iki katı. Mars kaybı da iki kat olduğu için masaya girmek bahsin iki
 * katı bakiye ister; böylece bakiye hiçbir zaman eksiye düşmez.
 */

export const STARTING_BALANCE = 1000;

// Altı saatte bir verilen ödül. Şampiyon masasına girmeye yeter, yani
// bakiyesi biten oyuncu beklediğinde en zor modda tekrar oynayabilir.
export const BONUS_AMOUNT = 1000;
export const BONUS_INTERVAL_MS = 6 * 60 * 60 * 1000;

export const TABLES = [
  { id: 'easy', name: 'Acemi Masası', bet: 50, difficulty: 'easy', desc: 'Rastgele hamleler' },
  { id: 'medium', name: 'Usta Masası', bet: 200, difficulty: 'medium', desc: 'Temel strateji' },
  { id: 'hard', name: 'Şampiyon Masası', bet: 500, difficulty: 'hard', desc: 'Konum analizi + ileri hamle' },
];

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

/** Oyuncunun girebileceği en yüksek masa (yoksa null). */
export function highestAffordableTable(balance) {
  let best = null;
  for (const t of TABLES) if (canPlay(balance, t)) best = t;
  return best;
}

/**
 * Oyun sonucunun bakiyeye etkisi.
 * points: 1 (normal) veya 2 (mars)
 */
export function settlement(bet, points, playerWon) {
  return playerWon ? bet * points : -bet * points;
}

/** Yarıda bırakılan oyun normal yenilgi sayılır. */
export function forfeitAmount(bet) {
  return -bet;
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

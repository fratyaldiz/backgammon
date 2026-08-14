export const WHITE = 1;
export const BLACK = -1;

/**
 * Zar atma animasyonunun süresi (ms). Hem görsel bileşen hem de oyun akışı
 * bu değeri kullanır: sonuç animasyon bitmeden okunamaz, yapay zeka da
 * hamlesine animasyon tamamlanmadan başlamaz.
 */
export const DICE_SPIN_MS = 800;

export function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

export function rollDice() {
  return [rollDie(), rollDie()];
}

export function getMovesFromDice(die1, die2) {
  if (die1 === die2) {
    return [die1, die1, die1, die1];
  }
  return [die1, die2];
}

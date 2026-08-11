export const WHITE = 1;
export const BLACK = -1;

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

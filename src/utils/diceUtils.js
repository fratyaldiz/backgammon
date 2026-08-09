export const WHITE = 1;
export const BLACK = -1;

export function rollDice() {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  return [die1, die2];
}

export function getMovesFromDice(die1, die2) {
  if (die1 === die2) {
    return [die1, die1, die1, die1];
  }
  return [die1, die2];
}

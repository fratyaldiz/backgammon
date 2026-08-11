import { WHITE, BLACK } from './diceUtils';

export function createInitialBoard() {
  const board = new Array(24).fill(0);
  board[23] = 2;
  board[12] = 5;
  board[7] = 3;
  board[5] = 5;
  
  board[0] = -2;
  board[11] = -5;
  board[16] = -3;
  board[18] = -5;
  return board;
}

export function cloneGameState(board, bar, borneOff) {
  return {
    board: [...board],
    bar: { ...bar },
    borneOff: { ...borneOff }
  };
}

export function canLandOn(board, pointIndex, player) {
  if (pointIndex < 0 || pointIndex > 23) return false;
  const count = board[pointIndex];
  if (count === 0) return true;
  if ((player === WHITE && count > 0) || (player === BLACK && count < 0)) return true;
  if ((player === WHITE && count === -1) || (player === BLACK && count === 1)) return true;
  return false;
}

export function canBearOff(board, bar, player) {
  let countOutside = 0;
  if (player === WHITE) {
    countOutside += bar.white;
    for (let i = 6; i < 24; i++) {
      if (board[i] > 0) countOutside += board[i];
    }
  } else {
    countOutside += bar.black;
    for (let i = 0; i < 18; i++) {
      if (board[i] < 0) countOutside -= board[i];
    }
  }
  return countOutside === 0;
}

export function getBarEntryPoint(dieValue, player) {
  return player === WHITE ? 24 - dieValue : dieValue - 1;
}

/**
 * Oyuncunun bar'da taşı var ve rakip giriş bölgesinin (kendi evinin) altı
 * noktasını da kapatmışsa hiçbir zar giriş sağlayamaz. Bu durumda tur
 * tamamen kayıptır; zar atmanın anlamı yoktur.
 */
export function isClosedOut(board, bar, player) {
  const barCount = player === WHITE ? bar.white : bar.black;
  if (barCount === 0) return false;

  // Giriş noktaları: WHITE 18-23, BLACK 0-5 (rakibin ev bölgesi)
  const entryStart = player === WHITE ? 18 : 0;
  for (let k = 0; k < 6; k++) {
    const v = board[entryStart + k];
    const oppCount = player === WHITE ? (v < 0 ? -v : 0) : (v > 0 ? v : 0);
    if (oppCount < 2) return false;   // en az bir nokta açık
  }
  return true;
}

export function applyMove(board, bar, borneOff, move, player) {
  const newState = cloneGameState(board, bar, borneOff);
  const newBoard = newState.board;
  const newBar = newState.bar;
  const newBorneOff = newState.borneOff;
  let isHit = false;

  if (move.from === 'bar') {
    if (player === WHITE) newBar.white--;
    else newBar.black--;
  } else {
    if (player === WHITE) newBoard[move.from]--;
    else newBoard[move.from]++;
  }

  if (move.to === 'off') {
    if (player === WHITE) newBorneOff.white++;
    else newBorneOff.black++;
  } else {
    const destCount = newBoard[move.to];
    if ((player === WHITE && destCount === -1) || (player === BLACK && destCount === 1)) {
      isHit = true;
      if (player === WHITE) {
        newBoard[move.to] = 1;
        newBar.black++;
      } else {
        newBoard[move.to] = -1;
        newBar.white++;
      }
    } else {
      if (player === WHITE) newBoard[move.to]++;
      else newBoard[move.to]--;
    }
  }

  return { board: newBoard, bar: newBar, borneOff: newBorneOff, hit: isHit };
}

export function getValidMovesForState(board, bar, borneOff, player, remainingDice) {
  const moves = [];
  const uniqueDice = [...new Set(remainingDice)];
  const playerBarCount = player === WHITE ? bar.white : bar.black;
  const canBear = canBearOff(board, bar, player);

  if (playerBarCount > 0) {
    for (const die of uniqueDice) {
      const dest = getBarEntryPoint(die, player);
      if (canLandOn(board, dest, player)) {
        moves.push({ from: 'bar', to: dest, dieValue: die });
      }
    }
    return moves;
  }

  for (let i = 0; i < 24; i++) {
    const hasChecker = player === WHITE ? board[i] > 0 : board[i] < 0;
    if (!hasChecker) continue;

    for (const die of uniqueDice) {
      const dest = player === WHITE ? i - die : i + die;
      
      if (dest >= 0 && dest <= 23) {
        if (canLandOn(board, dest, player)) {
          moves.push({ from: i, to: dest, dieValue: die });
        }
      } else if (canBear) {
        const isExact = (player === WHITE && dest === -1) || (player === BLACK && dest === 24);
        if (isExact) {
          moves.push({ from: i, to: 'off', dieValue: die });
        } else {
          let hasFarther = false;
          if (player === WHITE) {
            for (let j = i + 1; j <= 5; j++) {
              if (board[j] > 0) { hasFarther = true; break; }
            }
          } else {
            for (let j = i - 1; j >= 18; j--) {
              if (board[j] < 0) { hasFarther = true; break; }
            }
          }
          if (!hasFarther) {
            moves.push({ from: i, to: 'off', dieValue: die });
          }
        }
      }
    }
  }
  
  const deduplicated = [];
  const seen = new Set();
  for (const m of moves) {
    const key = `${m.from}-${m.to}-${m.dieValue}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(m);
    }
  }

  return deduplicated;
}

export function getAllLegalTurnSequences(board, bar, borneOff, player, remainingDice) {
  // Memoization: aynı (durum + kalan zar) alt problemleri tekrar hesaplanmaz.
  // Özellikle çift zarda permütasyon patlamasını önler; çıktı semantiği aynıdır.
  return _turnSequences(board, bar, borneOff, player, remainingDice, new Map());
}

function _turnSequences(board, bar, borneOff, player, remainingDice, memo) {
  if (remainingDice.length === 0) return [[]];

  const key = player + '|' + [...remainingDice].sort((a, b) => a - b).join(',')
    + '|' + board.join(',')
    + '|' + bar.white + ',' + bar.black
    + '|' + borneOff.white + ',' + borneOff.black;
  const cached = memo.get(key);
  if (cached) return cached;

  const validMoves = getValidMovesForState(board, bar, borneOff, player, remainingDice);
  if (validMoves.length === 0) { memo.set(key, [[]]); return [[]]; }

  const allSequences = [];

  for (const move of validMoves) {
    const nextState = applyMove(board, bar, borneOff, move, player);
    const diceIndex = remainingDice.indexOf(move.dieValue);
    const nextDice = [...remainingDice];
    nextDice.splice(diceIndex, 1);

    const subsequences = _turnSequences(
      nextState.board,
      nextState.bar,
      nextState.borneOff,
      player,
      nextDice,
      memo
    );

    for (const sub of subsequences) {
      allSequences.push([move, ...sub]);
    }
  }

  if (allSequences.length === 0) { memo.set(key, [[]]); return [[]]; }

  const maxLength = Math.max(...allSequences.map(seq => seq.length));
  let filtered = allSequences.filter(seq => seq.length === maxLength);

  if (maxLength === 1 && remainingDice.length === 2 && remainingDice[0] !== remainingDice[1]) {
    const largest = Math.max(...remainingDice);
    const canUseLarge = filtered.some(seq => seq[0].dieValue === largest);
    if (canUseLarge) {
      filtered = filtered.filter(seq => seq[0].dieValue === largest);
    }
  }

  memo.set(key, filtered);
  return filtered;
}

export function getValidFirstMoves(board, bar, borneOff, player, dice) {
  const sequences = getAllLegalTurnSequences(board, bar, borneOff, player, dice);
  const firstMoves = [];
  const seen = new Set();
  
  for (const seq of sequences) {
    if (seq.length > 0) {
      const fm = seq[0];
      const key = `${fm.from}-${fm.to}-${fm.dieValue}`;
      if (!seen.has(key)) {
        seen.add(key);
        firstMoves.push(fm);
      }
    }
  }
  
  return firstMoves;
}

export function getValidNextMoves(board, bar, borneOff, player, remainingDice, moveHistory) {
  let currentState = cloneGameState(board, bar, borneOff);
  for (const m of moveHistory) {
    currentState = applyMove(currentState.board, currentState.bar, currentState.borneOff, m, player);
  }
  return getValidFirstMoves(currentState.board, currentState.bar, currentState.borneOff, player, remainingDice);
}

export function isGameOver(borneOff) {
  if (borneOff.white === 15) return { gameOver: true, winner: WHITE };
  if (borneOff.black === 15) return { gameOver: true, winner: BLACK };
  return { gameOver: false, winner: null };
}

export function getPipCount(board, bar, player) {
  let pips = 0;
  if (player === WHITE) {
    for (let i = 0; i < 24; i++) {
      if (board[i] > 0) pips += board[i] * (i + 1);
    }
    pips += bar.white * 25;
  } else {
    for (let i = 0; i < 24; i++) {
      if (board[i] < 0) pips += Math.abs(board[i]) * (24 - i);
    }
    pips += bar.black * 25;
  }
  return pips;
}

export function evaluateBoard(board, bar, borneOff, player) {
  let score = 0;
  const opp = player === WHITE ? BLACK : WHITE;

  const myPips = getPipCount(board, bar, player);
  const oppPips = getPipCount(board, bar, opp);
  score += (oppPips - myPips) * 2; 

  const myBorneOff = player === WHITE ? borneOff.white : borneOff.black;
  score += myBorneOff * 10;

  const myBar = player === WHITE ? bar.white : bar.black;
  const oppBar = player === WHITE ? bar.black : bar.white;
  score -= myBar * 15;
  score += oppBar * 15;

  let myBlots = 0;
  let oppBlots = 0;
  let myPoints = 0;
  let consecutivePoints = 0;
  let maxPrime = 0;

  for (let i = 0; i < 24; i++) {
    const val = board[i];
    if (player === WHITE) {
      if (val === 1) myBlots++;
      else if (val === -1) oppBlots++;
      
      if (val >= 2) {
        myPoints++;
        consecutivePoints++;
        maxPrime = Math.max(maxPrime, consecutivePoints);
      } else {
        consecutivePoints = 0;
      }
    } else {
      if (val === -1) myBlots++;
      else if (val === 1) oppBlots++;
      
      if (val <= -2) {
        myPoints++;
        consecutivePoints++;
        maxPrime = Math.max(maxPrime, consecutivePoints);
      } else {
        consecutivePoints = 0;
      }
    }
  }

  score -= myBlots * 5;
  score += oppBlots * 5;
  score += myPoints * 3;
  score += maxPrime * 5;

  return score;
}

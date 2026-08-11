import { WHITE, BLACK } from './diceUtils';
import {
  cloneGameState,
  getValidMovesForState,
  applyMove,
  getAllLegalTurnSequences,
  getPipCount,
  evaluateBoard,
  canBearOff
} from './gameLogic';

const DICE_COMBINATIONS = [
  { roll: [1, 1, 1, 1], prob: 1 / 36 },
  { roll: [2, 2, 2, 2], prob: 1 / 36 },
  { roll: [3, 3, 3, 3], prob: 1 / 36 },
  { roll: [4, 4, 4, 4], prob: 1 / 36 },
  { roll: [5, 5, 5, 5], prob: 1 / 36 },
  { roll: [6, 6, 6, 6], prob: 1 / 36 },
  { roll: [1, 2], prob: 2 / 36 },
  { roll: [1, 3], prob: 2 / 36 },
  { roll: [1, 4], prob: 2 / 36 },
  { roll: [1, 5], prob: 2 / 36 },
  { roll: [1, 6], prob: 2 / 36 },
  { roll: [2, 3], prob: 2 / 36 },
  { roll: [2, 4], prob: 2 / 36 },
  { roll: [2, 5], prob: 2 / 36 },
  { roll: [2, 6], prob: 2 / 36 },
  { roll: [3, 4], prob: 2 / 36 },
  { roll: [3, 5], prob: 2 / 36 },
  { roll: [3, 6], prob: 2 / 36 },
  { roll: [4, 5], prob: 2 / 36 },
  { roll: [4, 6], prob: 2 / 36 },
  { roll: [5, 6], prob: 2 / 36 },
];

/**
 * Ensures state is cloned properly, falling back to manual clone if needed.
 */
function safeCloneState(board, bar, borneOff) {
  try {
    const cloned = cloneGameState(board, bar, borneOff);
    if (cloned && cloned.board) return cloned;
    if (cloned && cloned.state && cloned.state.board) return cloned.state;
  } catch (e) {
    // Ignore and use manual clone
  }
  return {
    board: [...board],
    bar: { ...bar },
    borneOff: { ...borneOff }
  };
}

/**
 * Applies a full sequence of moves to the board and returns the resulting state.
 */
function applySequence(board, bar, borneOff, moves, player) {
  let currentState = safeCloneState(board, bar, borneOff);
  for (const move of moves) {
    const nextState = applyMove(currentState.board, currentState.bar, currentState.borneOff, move, player);
    if (nextState && nextState.board) {
      currentState = nextState;
    }
  }
  return currentState;
}

// Performans sınırları: hesabın tek thread'i kilitlemesini önler.
const AI_MAX_STATES = 600;       // easy/medium: puanlanacak benzersiz sonuç sayısı
const AI_HARD_MAX_STATES = 100;  // hard: pahalı, daha düşük tavan
const AI_HARD_OPP_CAP = 20;      // hard: her zar kombinasyonu için rakip cevabı

function stateSignature(state) {
  return state.board.join(',')
    + '|' + (state.bar.white || 0) + ',' + (state.bar.black || 0)
    + '|' + (state.borneOff.white || 0) + ',' + (state.borneOff.black || 0);
}

/**
 * Sekansları nihai duruma göre tekilleştirir; permütasyonlar tek temsilciye iner.
 * cap'e ulaşınca durur (patlamayı önler). Döner: [{ seq, state }]
 */
function uniqueOutcomes(board, bar, borneOff, sequences, player, cap) {
  const map = new Map();
  for (const seq of sequences) {
    const state = applySequence(board, bar, borneOff, seq, player);
    const sig = stateSignature(state);
    if (!map.has(sig)) {
      map.set(sig, { seq, state });
      if (map.size >= cap) break;
    }
  }
  return Array.from(map.values());
}

/**
 * MEDIUM MODE: Evaluates and scores unique outcomes using a heuristic.
 */
function getMediumMove(board, bar, borneOff, player, outcomes) {
  let bestScore = -Infinity;
  let bestSequences = [];

  for (const { seq, state } of outcomes) {
    const score = scoreMediumSequence(board, bar, borneOff, state, player);

    if (score > bestScore) {
      bestScore = score;
      bestSequences = [seq];
    } else if (score === bestScore) {
      bestSequences.push(seq);
    }
  }

  const randomIndex = Math.floor(Math.random() * bestSequences.length);
  return bestSequences[randomIndex];
}

/**
 * Heuristic scoring for Medium difficulty.
 */
function scoreMediumSequence(initialBoard, initialBar, initialBorneOff, finalState, player) {
  let score = 0;
  const opponent = player === WHITE ? BLACK : WHITE;
  const oppBarKey = opponent === WHITE ? 'white' : 'black';
  const playerBarKey = player === WHITE ? 'white' : 'black';
  
  const initialOppBar = initialBar[oppBarKey] || 0;
  const finalOppBar = finalState.bar[oppBarKey] || 0;
  const hits = finalOppBar - initialOppBar;
  if (hits > 0) {
    score += hits * 5;
  }

  const initialPlayerBorneOff = initialBorneOff[playerBarKey] || 0;
  const finalPlayerBorneOff = finalState.borneOff[playerBarKey] || 0;
  const borneOffCount = finalPlayerBorneOff - initialPlayerBorneOff;
  if (borneOffCount > 0) {
    score += borneOffCount * 4;
  }

  for (let i = 0; i < 24; i++) {
    const initialCheckers = initialBoard[i];
    const finalCheckers = finalState.board[i];
    
    const initialPlayerCount = (player === WHITE && initialCheckers > 0) ? initialCheckers : (player === BLACK && initialCheckers < 0) ? -initialCheckers : 0;
    const finalPlayerCount = (player === WHITE && finalCheckers > 0) ? finalCheckers : (player === BLACK && finalCheckers < 0) ? -finalCheckers : 0;

    // +3 for each point made (going from 1 checker to 2+)
    if (initialPlayerCount < 2 && finalPlayerCount >= 2) {
      score += 3;
      
      // +3 for making a prime point (consecutive blocking points)
      let adjacentPoints = 0;
      if (i > 0) {
        const prev = finalState.board[i - 1];
        if ((player === WHITE && prev >= 2) || (player === BLACK && prev <= -2)) adjacentPoints++;
      }
      if (i < 23) {
        const next = finalState.board[i + 1];
        if ((player === WHITE && next >= 2) || (player === BLACK && next <= -2)) adjacentPoints++;
      }
      if (adjacentPoints > 0) score += 3;
    }

    // -4 for each new blot created (leaving a single checker exposed)
    if (initialPlayerCount !== 1 && finalPlayerCount === 1) {
      score -= 4;
      
      // -2 for each blot left in opponent's home board
      const inOppHome = (player === WHITE && i >= 18 && i <= 23) || (player === BLACK && i >= 0 && i <= 5);
      if (inOppHome) score -= 2;
    }

    // +2 for each checker moved to home board
    const inHome = (player === WHITE && i >= 0 && i <= 5) || (player === BLACK && i >= 18 && i <= 23);
    if (inHome && finalPlayerCount > initialPlayerCount) {
      score += 2 * (finalPlayerCount - initialPlayerCount);
    }
    
    // +2 for escaping from opponent's home board
    const isInOppHome = (player === WHITE && i >= 18 && i <= 23) || (player === BLACK && i >= 0 && i <= 5);
    if (isInOppHome && initialPlayerCount > finalPlayerCount) {
      score += 2 * (initialPlayerCount - finalPlayerCount);
    }
  }

  return score;
}

/**
 * HARD MODE: Expectiminimax limited to 1 ply (opponent's response).
 */
function getHardMove(board, bar, borneOff, player, outcomes) {
  let bestScore = -Infinity;
  let bestSequences = [];
  const opponent = player === WHITE ? BLACK : WHITE;

  for (const { seq, state: afterAiState } of outcomes) {
    let expectedEvaluation = 0;

    for (const combo of DICE_COMBINATIONS) {
      const oppSequences = getAllLegalTurnSequences(afterAiState.board, afterAiState.bar, afterAiState.borneOff, opponent, combo.roll);

      let minEvalForAi = Infinity;

      if (!oppSequences || oppSequences.length === 0 || (oppSequences.length === 1 && oppSequences[0].length === 0)) {
        minEvalForAi = evaluateBoard(afterAiState.board, afterAiState.bar, afterAiState.borneOff, player);
      } else {
        // Rakip cevaplarını da tekilleştir + sınırla (hard modun patlamasını önler)
        const oppOutcomes = uniqueOutcomes(afterAiState.board, afterAiState.bar, afterAiState.borneOff, oppSequences, opponent, AI_HARD_OPP_CAP);
        for (const oo of oppOutcomes) {
          const evalScore = evaluateBoard(oo.state.board, oo.state.bar, oo.state.borneOff, player);
          if (evalScore < minEvalForAi) {
            minEvalForAi = evalScore;
          }
        }
      }

      expectedEvaluation += minEvalForAi * combo.prob;
    }

    if (expectedEvaluation > bestScore) {
      bestScore = expectedEvaluation;
      bestSequences = [seq];
    } else if (expectedEvaluation === bestScore) {
      bestSequences.push(seq);
    }
  }

  const randomIndex = Math.floor(Math.random() * bestSequences.length);
  return bestSequences[randomIndex];
}

/**
 * Main entry point for the AI to calculate its turn.
 */
export function getAIMoves(board, bar, borneOff, player, dice, difficulty = 'easy') {
  const sequences = getAllLegalTurnSequences(board, bar, borneOff, player, dice);

  if (!sequences || sequences.length === 0 || (sequences.length === 1 && sequences[0].length === 0)) {
    return [];
  }

  // Sonuçları nihai duruma göre tekilleştir + tavana kadar sınırla.
  const cap = difficulty === 'hard' ? AI_HARD_MAX_STATES : AI_MAX_STATES;
  const outcomes = uniqueOutcomes(board, bar, borneOff, sequences, player, cap);
  if (outcomes.length === 0) return [];

  switch (difficulty) {
    case 'medium':
      return getMediumMove(board, bar, borneOff, player, outcomes);
    case 'hard':
      return getHardMove(board, bar, borneOff, player, outcomes);
    case 'easy':
    default:
      return outcomes[Math.floor(Math.random() * outcomes.length)].seq;
  }
}

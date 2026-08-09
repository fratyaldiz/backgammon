import { create } from 'zustand';
import { WHITE, BLACK, rollDice as rollDiceUtil, getMovesFromDice } from '../utils/diceUtils';
import {
  createInitialBoard, cloneGameState, canBearOff,
  getValidFirstMoves, getValidNextMoves, applyMove,
  isGameOver, getPipCount, getAllLegalTurnSequences
} from '../utils/gameLogic';
import { getAIMoves } from '../utils/aiPlayer';

const useGameStore = create((set, get) => ({
  board: createInitialBoard(),
  bar: { white: 0, black: 0 },
  borneOff: { white: 0, black: 0 },
  currentPlayer: WHITE,
  dice: null,
  remainingMoves: [],
  selectedPoint: null,
  validDestinations: [],
  gamePhase: 'menu',
  difficulty: 'medium',
  winner: null,
  message: '',
  moveHistory: [],
  lastMove: null,
  showDoublesIndicator: false,
  turnFinished: false,
  turnInitialState: null,

  startGame: (difficulty) => set({
    board: createInitialBoard(),
    bar: { white: 0, black: 0 },
    borneOff: { white: 0, black: 0 },
    currentPlayer: WHITE,
    dice: null,
    remainingMoves: [],
    selectedPoint: null,
    validDestinations: [],
    gamePhase: 'rolling',
    difficulty,
    winner: null,
    message: '',
    moveHistory: [],
    lastMove: null,
    showDoublesIndicator: false,
    turnFinished: false,
    turnInitialState: null,
  }),

  rollDice: () => {
    const dice = rollDiceUtil();
    const remainingMoves = getMovesFromDice(dice[0], dice[1]);
    const { board, bar, borneOff, currentPlayer } = get();

    const validMoves = getValidFirstMoves(board, bar, borneOff, currentPlayer, remainingMoves);

    if (validMoves.length === 0) {
      set({
        dice,
        remainingMoves,
        message: 'Hamle yok! Turu bitirebilirsiniz.',
        gamePhase: 'moving',
        showDoublesIndicator: dice[0] === dice[1],
        turnFinished: true,
      });
    } else {
      set({
        dice,
        remainingMoves,
        gamePhase: 'moving',
        message: '',
        showDoublesIndicator: dice[0] === dice[1],
        turnFinished: false,
        turnInitialState: {
          board: [...board],
          bar: { ...bar },
          borneOff: { ...borneOff },
          remainingMoves: [...remainingMoves]
        }
      });
    }
  },

  selectPoint: (pointIndex) => {
    const { board, bar, currentPlayer, gamePhase, remainingMoves, selectedPoint, borneOff, moveHistory } = get();
    if (gamePhase !== 'moving' || currentPlayer !== WHITE) return;

    // Check if we can select this point
    let canSelect = false;
    if (pointIndex === 'bar') {
      const barCount = currentPlayer === WHITE ? bar.white : bar.black;
      canSelect = barCount > 0;
    } else if (typeof pointIndex === 'number' && pointIndex >= 0 && pointIndex <= 23) {
      const checkerOwner = board[pointIndex] > 0 ? WHITE : board[pointIndex] < 0 ? BLACK : 0;
      canSelect = checkerOwner === currentPlayer;
    }

    if (canSelect) {
      // Get valid moves for this selection
      let validMoves;
      if (moveHistory.length === 0) {
        validMoves = getValidFirstMoves(board, bar, borneOff, currentPlayer, remainingMoves);
      } else {
        validMoves = getValidNextMoves(board, bar, borneOff, currentPlayer, remainingMoves, moveHistory);
      }

      const availableMoves = validMoves.filter(m => m.from === pointIndex);

      if (availableMoves.length > 0) {
        // Otomatik hareket - en büyük zar değerini önceliklendirir
        availableMoves.sort((a, b) => b.dieValue - a.dieValue);
        const moveToMake = availableMoves[0];
        get().moveChecker(pointIndex, moveToMake.to);
      }
    }
  },

  moveChecker: (fromIndex, toIndex) => {
    const { board, bar, borneOff, currentPlayer, remainingMoves, moveHistory } = get();

    // Get valid moves to find the matching move
    let validMoves;
    if (moveHistory.length === 0) {
      validMoves = getValidFirstMoves(board, bar, borneOff, currentPlayer, remainingMoves);
    } else {
      validMoves = getValidNextMoves(board, bar, borneOff, currentPlayer, remainingMoves, moveHistory);
    }

    const move = validMoves.find(m => m.from === fromIndex && m.to === toIndex);
    if (!move) return;

    // Apply the move
    const newState = applyMove(board, bar, borneOff, move, currentPlayer);
    const newRemainingMoves = [...remainingMoves];
    const usedIndex = newRemainingMoves.indexOf(move.dieValue);
    if (usedIndex !== -1) {
      newRemainingMoves.splice(usedIndex, 1);
    }

    const newMoveHistory = [...moveHistory, move];

    // Check game over
    const gameOverResult = isGameOver(newState.borneOff);
    if (gameOverResult.gameOver) {
      set({
        board: newState.board,
        bar: newState.bar,
        borneOff: newState.borneOff,
        remainingMoves: newRemainingMoves,
        moveHistory: newMoveHistory,
        lastMove: move,
        selectedPoint: null,
        validDestinations: [],
        gamePhase: 'game_over',
        winner: currentPlayer,
        message: '',
      });
      return;
    }

    // Check if there are more moves to make
    let hasNextMoves = false;
    if (newRemainingMoves.length > 0) {
      const nextValidMoves = getValidFirstMoves(
        newState.board, newState.bar, newState.borneOff,
        currentPlayer, newRemainingMoves
      );
      hasNextMoves = nextValidMoves.length > 0;
    }

    set({
      board: newState.board,
      bar: newState.bar,
      borneOff: newState.borneOff,
      remainingMoves: newRemainingMoves,
      moveHistory: newMoveHistory,
      lastMove: move,
      selectedPoint: null,
      validDestinations: [],
    });

    if (!hasNextMoves) {
      if (newRemainingMoves.length > 0) {
        set({ message: 'Kalan zarlar için hamle yok.' });
      }
      set({ turnFinished: true });
    }
  },

  undoMove: () => {
    const { moveHistory, turnInitialState, currentPlayer } = get();
    if (!turnInitialState || moveHistory.length === 0) return;

    let currentState = cloneGameState(
      turnInitialState.board,
      turnInitialState.bar,
      turnInitialState.borneOff
    );

    // Replay all moves except the last one
    const newMoveHistory = moveHistory.slice(0, -1);
    const newRemainingMoves = [...turnInitialState.remainingMoves];

    for (const m of newMoveHistory) {
      currentState = applyMove(currentState.board, currentState.bar, currentState.borneOff, m, currentPlayer);
      const idx = newRemainingMoves.indexOf(m.dieValue);
      if (idx !== -1) newRemainingMoves.splice(idx, 1);
    }

    set({
      board: currentState.board,
      bar: currentState.bar,
      borneOff: currentState.borneOff,
      remainingMoves: newRemainingMoves,
      moveHistory: newMoveHistory,
      lastMove: newMoveHistory.length > 0 ? newMoveHistory[newMoveHistory.length - 1] : null,
      selectedPoint: null,
      validDestinations: [],
      turnFinished: false,
      message: '',
    });
  },

  endTurn: () => {
    const nextPlayer = get().currentPlayer === WHITE ? BLACK : WHITE;
    set({
      currentPlayer: nextPlayer,
      dice: null,
      remainingMoves: [],
      moveHistory: [],
      selectedPoint: null,
      validDestinations: [],
      message: '',
      lastMove: null,
      showDoublesIndicator: false,
      turnFinished: false,
    });

    if (nextPlayer === BLACK) {
      set({ gamePhase: 'ai_thinking', message: 'Rakip düşünüyor...' });
      setTimeout(() => get().executeAITurn(), 800);
    } else {
      set({ gamePhase: 'rolling' });
    }
  },

  executeAITurn: () => {
    const dice = rollDiceUtil();
    const remainingMoves = getMovesFromDice(dice[0], dice[1]);
    set({
      dice,
      remainingMoves,
      showDoublesIndicator: dice[0] === dice[1],
    });

    const { board, bar, borneOff, difficulty } = get();

    setTimeout(() => {
      let moves;
      try {
        moves = getAIMoves(board, bar, borneOff, BLACK, remainingMoves, difficulty);
      } catch (e) {
        moves = [];
      }

      if (!moves || moves.length === 0) {
        set({ message: 'Rakibin hamlesi yok.' });
        setTimeout(() => get().endTurn(), 1200);
        return;
      }

      let i = 0;
      const applyNext = () => {
        if (i < moves.length) {
          const move = moves[i];
          const currentState = get();
          let newState;
          try {
            newState = applyMove(currentState.board, currentState.bar, currentState.borneOff, move, BLACK);
          } catch (e) {
            // If a move fails, skip it and continue
            i++;
            setTimeout(applyNext, 300);
            return;
          }

          set({
            board: newState.board,
            bar: newState.bar,
            borneOff: newState.borneOff,
            lastMove: move,
          });

          // Check game over
          const gameOverResult = isGameOver(newState.borneOff);
          if (gameOverResult.gameOver) {
            set({ gamePhase: 'game_over', winner: BLACK, message: '' });
            return;
          }

          i++;
          setTimeout(applyNext, 500);
        } else {
          setTimeout(() => get().endTurn(), 400);
        }
      };

      applyNext();
    }, 600);
  },

  goToMenu: () => set({
    gamePhase: 'menu',
    board: createInitialBoard(),
    bar: { white: 0, black: 0 },
    borneOff: { white: 0, black: 0 },
    currentPlayer: WHITE,
    dice: null,
    remainingMoves: [],
    selectedPoint: null,
    validDestinations: [],
    winner: null,
    message: '',
    moveHistory: [],
    lastMove: null,
    showDoublesIndicator: false,
    turnFinished: false,
    turnInitialState: null,
  }),

  setDifficulty: (d) => set({ difficulty: d }),
  resetGame: () => get().startGame(get().difficulty),
}));

export default useGameStore;

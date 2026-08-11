import { create } from 'zustand';
import { WHITE, BLACK, rollDice as rollDiceUtil, getMovesFromDice } from '../utils/diceUtils';
import {
  createInitialBoard, cloneGameState,
  getValidFirstMoves, applyMove,
  isGameOver, getAllLegalTurnSequences
} from '../utils/gameLogic';
import { getAIMoves } from '../utils/aiPlayer';

const useGameStore = create((set, get) => ({
  board: createInitialBoard(),
  bar: { white: 0, black: 0 },
  borneOff: { white: 0, black: 0 },
  currentPlayer: WHITE,
  playerColor: BLACK,       // Oyuncu her zaman SİYAH
  dice: null,
  remainingMoves: [],
  selectedPoint: null,
  validDestinations: [],
  gamePhase: 'menu',
  previousPhase: null,
  difficulty: 'medium',
  winner: null,
  message: '',
  moveHistory: [],
  lastMove: null,
  showDoublesIndicator: false,
  turnFinished: false,
  turnInitialState: null,

  // ─── OYUN BAŞLAT ─────────────────────────────
  startGame: (difficulty) => {
    set({
      board: createInitialBoard(),
      bar: { white: 0, black: 0 },
      borneOff: { white: 0, black: 0 },
      currentPlayer: WHITE,    // Beyaz her zaman ilk başlar
      playerColor: BLACK,
      dice: null,
      remainingMoves: [],
      selectedPoint: null,
      validDestinations: [],
      gamePhase: 'ai_thinking',  // Yapay zeka (beyaz) ilk oynar
      previousPhase: null,
      difficulty: difficulty || 'medium',
      winner: null,
      message: 'Siyah taşlarla oynuyorsunuz. Rakip oynuyor...',
      moveHistory: [],
      lastMove: null,
      showDoublesIndicator: false,
      turnFinished: false,
      turnInitialState: null,
    });
    // Yapay zeka ilk hamleyi yapar
    setTimeout(() => get().executeAITurn(), 1000);
  },

  // ─── DURAKLAT / DEVAM ────────────────────────
  pauseGame: () => {
    const phase = get().gamePhase;
    if (phase !== 'menu' && phase !== 'paused' && phase !== 'game_over') {
      set({ gamePhase: 'paused', previousPhase: phase });
    }
  },
  resumeGame: () => {
    const prev = get().previousPhase;
    if (get().gamePhase === 'paused' && prev) {
      set({ gamePhase: prev, previousPhase: null });
    }
  },

  // ─── ZAR AT ──────────────────────────────────
  rollDice: () => {
    const { gamePhase, currentPlayer, playerColor } = get();
    if (gamePhase !== 'rolling' || currentPlayer !== playerColor) return;

    const dice = rollDiceUtil();
    const remainingMoves = getMovesFromDice(dice[0], dice[1]);
    const { board, bar, borneOff } = get();

    const validMoves = getValidFirstMoves(board, bar, borneOff, currentPlayer, remainingMoves);

    if (validMoves.length === 0) {
      set({
        dice, remainingMoves,
        message: 'Hamle yok! Turu bitirebilirsiniz.',
        gamePhase: 'moving',
        showDoublesIndicator: dice[0] === dice[1],
        turnFinished: true,
      });
    } else {
      set({
        dice, remainingMoves,
        gamePhase: 'moving',
        message: '',
        showDoublesIndicator: dice[0] === dice[1],
        turnFinished: false,
        turnInitialState: {
          board: [...board],
          bar: { ...bar },
          borneOff: { ...borneOff },
          remainingMoves: [...remainingMoves],
        },
      });
    }
  },

  // ─── DOKUNARAK OTOMATİK HAREKET ──────────────
  selectPoint: (pointIndex) => {
    const { board, bar, currentPlayer, playerColor, gamePhase, remainingMoves, borneOff, turnFinished } = get();
    if (gamePhase !== 'moving' || currentPlayer !== playerColor || turnFinished) return;

    // Geçerli hamleleri bul (güncel tahta üzerinde)
    const validMoves = getValidFirstMoves(board, bar, borneOff, currentPlayer, remainingMoves);

    // Bardaki taş varsa ve başka nokta tıklandıysa uyar
    const barCount = currentPlayer === WHITE ? bar.white : bar.black;
    if (barCount > 0 && pointIndex !== 'bar') {
      set({ message: 'Önce bardaki taşınızı yerleştirin!' });
      return;
    }

    const movesFromPoint = validMoves.filter(m => m.from === pointIndex);

    if (movesFromPoint.length > 0) {
      // Otomatik hamle: en büyük zar değerini önceliklendir
      movesFromPoint.sort((a, b) => b.dieValue - a.dieValue);
      get().moveChecker(pointIndex, movesFromPoint[0].to);
    }
  },

  // ─── SÜRÜKLE-BIRAK HAMLESİ ───────────────────
  moveToDestination: (fromIndex, toIndex) => {
    const { board, bar, borneOff, currentPlayer, playerColor, gamePhase, remainingMoves, turnFinished } = get();
    if (gamePhase !== 'moving' || currentPlayer !== playerColor || turnFinished) return;

    const validMoves = getValidFirstMoves(board, bar, borneOff, currentPlayer, remainingMoves);
    const isValid = validMoves.some(m => m.from === fromIndex && m.to === toIndex);

    if (isValid) {
      get().moveChecker(fromIndex, toIndex);
    }
  },

  // ─── ANA HAMLE MOTORU ────────────────────────
  moveChecker: (fromIndex, toIndex) => {
    const { board, bar, borneOff, currentPlayer, remainingMoves, moveHistory } = get();

    const validMoves = getValidFirstMoves(board, bar, borneOff, currentPlayer, remainingMoves);
    const move = validMoves.find(m => m.from === fromIndex && m.to === toIndex);
    if (!move) return;

    const newState = applyMove(board, bar, borneOff, move, currentPlayer);
    const newRemainingMoves = [...remainingMoves];
    const usedIndex = newRemainingMoves.indexOf(move.dieValue);
    if (usedIndex !== -1) newRemainingMoves.splice(usedIndex, 1);

    const newMoveHistory = [...moveHistory, move];

    // Oyun bitti mi?
    const gameOverResult = isGameOver(newState.borneOff);
    if (gameOverResult.gameOver) {
      set({
        board: newState.board, bar: newState.bar, borneOff: newState.borneOff,
        remainingMoves: newRemainingMoves, moveHistory: newMoveHistory,
        lastMove: move, selectedPoint: null, validDestinations: [],
        gamePhase: 'game_over', winner: currentPlayer, message: '',
      });
      return;
    }

    // Daha hamle var mı?
    let hasNextMoves = false;
    if (newRemainingMoves.length > 0) {
      const nextValidMoves = getValidFirstMoves(newState.board, newState.bar, newState.borneOff, currentPlayer, newRemainingMoves);
      hasNextMoves = nextValidMoves.length > 0;
    }

    set({
      board: newState.board, bar: newState.bar, borneOff: newState.borneOff,
      remainingMoves: newRemainingMoves, moveHistory: newMoveHistory,
      lastMove: move, selectedPoint: null, validDestinations: [], message: '',
    });

    if (!hasNextMoves) {
      if (newRemainingMoves.length > 0) set({ message: 'Kalan zarlar için hamle yok.' });
      set({ turnFinished: true });
    }
  },

  // ─── GERİ AL ─────────────────────────────────
  undoMove: () => {
    const { moveHistory, turnInitialState, currentPlayer, dice } = get();
    if (!turnInitialState || moveHistory.length === 0) return;

    const freshMoves = getMovesFromDice(dice[0], dice[1]);
    let currentState = cloneGameState(turnInitialState.board, turnInitialState.bar, turnInitialState.borneOff);
    const newMoveHistory = moveHistory.slice(0, -1);
    const newRemainingMoves = [...freshMoves];

    for (const m of newMoveHistory) {
      currentState = applyMove(currentState.board, currentState.bar, currentState.borneOff, m, currentPlayer);
      const idx = newRemainingMoves.indexOf(m.dieValue);
      if (idx !== -1) newRemainingMoves.splice(idx, 1);
    }

    set({
      board: currentState.board, bar: currentState.bar, borneOff: currentState.borneOff,
      remainingMoves: newRemainingMoves, moveHistory: newMoveHistory,
      lastMove: newMoveHistory.length > 0 ? newMoveHistory[newMoveHistory.length - 1] : null,
      selectedPoint: null, validDestinations: [], turnFinished: false, message: '',
    });
  },

  // ─── TUR BİTİR ──────────────────────────────
  endTurn: () => {
    const { playerColor } = get();
    const nextPlayer = get().currentPlayer === WHITE ? BLACK : WHITE;

    set({
      currentPlayer: nextPlayer, dice: null, remainingMoves: [],
      moveHistory: [], selectedPoint: null, validDestinations: [],
      message: '', lastMove: null, showDoublesIndicator: false,
      turnFinished: false, turnInitialState: null,
    });

    if (nextPlayer === playerColor) {
      set({ gamePhase: 'rolling' });
    } else {
      set({ gamePhase: 'ai_thinking', message: 'Rakip düşünüyor...' });
      setTimeout(() => get().executeAITurn(), 800);
    }
  },

  // ─── YAPAY ZEKA TURU ─────────────────────────
  executeAITurn: () => {
    const dice = rollDiceUtil();
    const remainingMoves = getMovesFromDice(dice[0], dice[1]);
    set({ dice, remainingMoves, showDoublesIndicator: dice[0] === dice[1] });

    const { board, bar, borneOff, difficulty, currentPlayer } = get();

    setTimeout(() => {
      let moves;
      try { moves = getAIMoves(board, bar, borneOff, currentPlayer, remainingMoves, difficulty); }
      catch (e) { moves = []; }

      if (!moves || moves.length === 0) {
        set({ message: 'Rakibin hamlesi yok.' });
        setTimeout(() => get().endTurn(), 1200);
        return;
      }

      let i = 0;
      const applyNext = () => {
        if (i < moves.length) {
          const move = moves[i];
          const s = get();
          if (s.gamePhase !== 'ai_thinking') return;

          let newState;
          try { newState = applyMove(s.board, s.bar, s.borneOff, move, s.currentPlayer); }
          catch (e) { i++; setTimeout(applyNext, 300); return; }

          set({ board: newState.board, bar: newState.bar, borneOff: newState.borneOff, lastMove: move });

          const result = isGameOver(newState.borneOff);
          if (result.gameOver) { set({ gamePhase: 'game_over', winner: s.currentPlayer, message: '' }); return; }

          i++;
          setTimeout(applyNext, 500);
        } else {
          setTimeout(() => get().endTurn(), 400);
        }
      };
      applyNext();
    }, 600);
  },

  // ─── MENÜLER ─────────────────────────────────
  goToMenu: () => set({
    gamePhase: 'menu', board: createInitialBoard(),
    bar: { white: 0, black: 0 }, borneOff: { white: 0, black: 0 },
    currentPlayer: WHITE, playerColor: BLACK, dice: null,
    remainingMoves: [], selectedPoint: null, validDestinations: [],
    winner: null, message: '', moveHistory: [], lastMove: null,
    showDoublesIndicator: false, turnFinished: false, turnInitialState: null, previousPhase: null,
  }),
  setDifficulty: (d) => set({ difficulty: d }),
  resetGame: () => get().startGame(get().difficulty),
}));

export default useGameStore;

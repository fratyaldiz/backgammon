import { create } from 'zustand';
import { WHITE, BLACK, rollDice as rollDiceUtil, rollDie, getMovesFromDice } from '../utils/diceUtils';
import {
  createInitialBoard, cloneGameState,
  getValidFirstMoves, applyMove,
  isGameOver, isClosedOut, getWinType
} from '../utils/gameLogic';
import { getAIMoves } from '../utils/aiPlayer';
import {
  saveGame, loadGame, clearSavedGame,
  loadStats, saveStats, resetStats,
  loadSettings, saveSettings
} from '../utils/storage';
import { haptics, setHapticsEnabled } from '../utils/feedback';

const EMPTY_STATS = { played: 0, won: 0, lost: 0, marsWon: 0, marsLost: 0 };

const useGameStore = create((set, get) => {
  /**
   * Duraklatma sırasında zamanlayıcılar ilerlemez, kaldıkları yerden devam
   * eder. Bu sayede duraklatma oyun fazını değiştirmek zorunda kalmaz ve
   * menü her an açılabilir (faz değiştirmek zincirleri koparıyordu).
   */
  const schedule = (fn, ms) => {
    const tick = () => {
      if (get().isPaused) { setTimeout(tick, 250); return; }
      fn();
    };
    setTimeout(tick, ms);
  };

  // Yalnızca kararlı anlarda kaydedilir: yapay zekanın hamle zinciri
  // ortasında kayıt alınmaz, böylece geri yüklemede tur baştan ve
  // kurallara uygun şekilde tekrar oynanır.
  const persist = () => { saveGame(get()); };

  /**
   * Oyuncunun turunu başlatır. Rakip tahtayı tamamen kapattıysa ve bar'da
   * taşımız varsa hiçbir zar giriş sağlamaz; zar sorulmadan sıra geçer.
   */
  const beginPlayerTurn = () => {
    const { board, bar, playerColor, autoSkipCount } = get();
    const aiColor = playerColor === WHITE ? BLACK : WHITE;
    const stuck = isClosedOut(board, bar, playerColor) && !isClosedOut(board, bar, aiColor);

    // autoSkipCount: kuramsal karşılıklı kilitlenmede sonsuz döngüyü keser
    if (stuck && autoSkipCount < 30) {
      set({
        gamePhase: 'closed_out',
        autoSkipCount: autoSkipCount + 1,
        message: 'Rakip tahtayı kapattı — giriş yok, sıra geçiyor.',
      });
      schedule(() => {
        if (get().gamePhase === 'closed_out') get().endTurn();
      }, 1500);
      return;
    }
    set({ gamePhase: 'rolling' });
    persist();
  };

  return {
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
    isPaused: false,
    difficulty: 'medium',
    winner: null,
    winType: null,            // 'normal' | 'mars'
    winPoints: 0,
    message: '',
    moveHistory: [],
    lastMove: null,
    moveSeq: 0,
    showDoublesIndicator: false,
    turnFinished: false,
    turnInitialState: null,
    openingDice: { player: null, ai: null },
    openingRolling: false,
    autoSkipCount: 0,
    hasSavedGame: false,
    stats: { ...EMPTY_STATS },
    settings: { haptics: true },

    // ─── UYGULAMA AÇILIŞI ────────────────────────
    initApp: async () => {
      const [settings, stats, saved] = await Promise.all([
        loadSettings(), loadStats(), loadGame(),
      ]);
      setHapticsEnabled(settings.haptics);
      set({ settings, stats, hasSavedGame: !!saved });
    },

    // ─── KAYITLI OYUNA DEVAM ─────────────────────
    continueGame: async () => {
      const saved = await loadGame();
      if (!saved) { set({ hasSavedGame: false }); return; }

      set({
        board: saved.board,
        bar: saved.bar,
        borneOff: saved.borneOff,
        currentPlayer: saved.currentPlayer,
        playerColor: saved.playerColor,
        dice: saved.dice,
        remainingMoves: saved.remainingMoves || [],
        difficulty: saved.difficulty || 'medium',
        turnFinished: !!saved.turnFinished,
        turnInitialState: saved.turnInitialState || null,
        moveHistory: saved.moveHistory || [],
        autoSkipCount: saved.autoSkipCount || 0,
        selectedPoint: null,
        validDestinations: [],
        winner: null, winType: null, winPoints: 0,
        message: '', lastMove: null, moveSeq: 0,
        showDoublesIndicator: false,
        isPaused: false,
        openingDice: { player: null, ai: null },
        openingRolling: false,
        gamePhase: saved.gamePhase,
      });

      // Kayıt yapay zekanın turu başlamadan alındığı için tur baştan oynanır
      if (saved.gamePhase === 'ai_thinking') {
        set({ message: 'Rakip düşünüyor...' });
        schedule(() => get().executeAITurn(), 700);
      } else if (saved.gamePhase === 'closed_out') {
        beginPlayerTurn();
      }
    },

    // ─── OYUN BAŞLAT ─────────────────────────────
    startGame: (difficulty) => {
      clearSavedGame();
      set({
        board: createInitialBoard(),
        bar: { white: 0, black: 0 },
        borneOff: { white: 0, black: 0 },
        currentPlayer: WHITE,
        playerColor: BLACK,
        dice: null,
        remainingMoves: [],
        selectedPoint: null,
        validDestinations: [],
        gamePhase: 'opening_roll',   // Başlangıç: her iki taraf birer zar atar
        isPaused: false,
        difficulty: difficulty || 'medium',
        winner: null, winType: null, winPoints: 0,
        message: 'Başlangıç zarı: yüksek atan başlar.',
        moveHistory: [],
        lastMove: null,
        moveSeq: 0,
        showDoublesIndicator: false,
        turnFinished: false,
        turnInitialState: null,
        openingDice: { player: null, ai: null },
        openingRolling: false,
        autoSkipCount: 0,
        hasSavedGame: false,
      });
    },

    // ─── AÇILIŞ ZARI (kim başlayacak?) ───────────
    // Her iki taraf birer zar atar; yüksek atan taraf yeni bir zarla oyuna
    // başlar. Eşitlikte atış tekrarlanır.
    rollOpeningDice: () => {
      const { gamePhase, openingRolling, playerColor } = get();
      if (gamePhase !== 'opening_roll' || openingRolling) return;

      const playerDie = rollDie();
      const aiDie = rollDie();
      haptics.roll();
      set({ openingDice: { player: playerDie, ai: aiDie }, openingRolling: true, message: '' });

      schedule(() => {
        if (get().gamePhase !== 'opening_roll') return;

        if (playerDie === aiDie) {
          set({
            openingDice: { player: null, ai: null },
            openingRolling: false,
            message: 'Beraberlik! Tekrar atın.',
          });
          return;
        }

        const aiColor = playerColor === WHITE ? BLACK : WHITE;
        const playerStarts = playerDie > aiDie;

        set({
          currentPlayer: playerStarts ? playerColor : aiColor,
          openingRolling: false,
          message: playerStarts ? 'Yüksek zar sizde — siz başlıyorsunuz.' : 'Rakip yüksek attı — rakip başlıyor.',
        });

        schedule(() => {
          if (get().gamePhase !== 'opening_roll') return;
          set({ openingDice: { player: null, ai: null } });

          if (playerStarts) {
            set({ gamePhase: 'rolling', message: '' });
            persist();
          } else {
            set({ gamePhase: 'ai_thinking', message: 'Rakip düşünüyor...' });
            persist();
            schedule(() => get().executeAITurn(), 600);
          }
        }, 1300);
      }, 900);
    },

    // ─── DURAKLAT / DEVAM ────────────────────────
    // Duraklatma artık gamePhase'i değiştirmez; yalnızca bir bayrak. Böylece
    // menü yapay zekanın turunda da, açılış zarında da açılabilir.
    pauseGame: () => {
      const phase = get().gamePhase;
      if (phase === 'menu' || phase === 'game_over') return;
      set({ isPaused: true });
    },
    resumeGame: () => set({ isPaused: false }),

    // ─── ZAR AT ──────────────────────────────────
    rollDice: () => {
      const { gamePhase, currentPlayer, playerColor } = get();
      if (gamePhase !== 'rolling' || currentPlayer !== playerColor) return;

      const dice = rollDiceUtil();
      const remainingMoves = getMovesFromDice(dice[0], dice[1]);
      const { board, bar, borneOff } = get();
      haptics.roll();
      set({ autoSkipCount: 0 });   // oyuncu tekrar zar atabildi: sayaç sıfırlanır

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
      persist();
    },

    // ─── DOKUNARAK OTOMATİK HAREKET ──────────────
    selectPoint: (pointIndex) => {
      const { board, bar, currentPlayer, playerColor, gamePhase, remainingMoves, borneOff, turnFinished, isPaused } = get();
      if (isPaused || gamePhase !== 'moving' || currentPlayer !== playerColor || turnFinished) return;

      const validMoves = getValidFirstMoves(board, bar, borneOff, currentPlayer, remainingMoves);

      // Bardaki taş varsa başka nokta oynanamaz
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
      const { board, bar, borneOff, currentPlayer, playerColor, gamePhase, remainingMoves, turnFinished, isPaused } = get();
      if (isPaused || gamePhase !== 'moving' || currentPlayer !== playerColor || turnFinished) return;

      const validMoves = getValidFirstMoves(board, bar, borneOff, currentPlayer, remainingMoves);
      const isValid = validMoves.some(m => m.from === fromIndex && m.to === toIndex);

      if (isValid) get().moveChecker(fromIndex, toIndex);
    },

    // ─── ANA HAMLE MOTORU ────────────────────────
    moveChecker: (fromIndex, toIndex) => {
      const { board, bar, borneOff, currentPlayer, remainingMoves, moveHistory, moveSeq } = get();

      const validMoves = getValidFirstMoves(board, bar, borneOff, currentPlayer, remainingMoves);
      const move = validMoves.find(m => m.from === fromIndex && m.to === toIndex);
      if (!move) return;

      const newState = applyMove(board, bar, borneOff, move, currentPlayer);
      const newRemainingMoves = [...remainingMoves];
      const usedIndex = newRemainingMoves.indexOf(move.dieValue);
      if (usedIndex !== -1) newRemainingMoves.splice(usedIndex, 1);

      const newMoveHistory = [...moveHistory, move];

      if (newState.hit) haptics.hit();
      else if (move.to === 'off') haptics.bearOff();
      else haptics.move();

      // Oyun bitti mi?
      const gameOverResult = isGameOver(newState.borneOff);
      if (gameOverResult.gameOver) {
        set({
          board: newState.board, bar: newState.bar, borneOff: newState.borneOff,
          remainingMoves: newRemainingMoves, moveHistory: newMoveHistory,
          lastMove: move, moveSeq: moveSeq + 1, selectedPoint: null, validDestinations: [],
        });
        get().finishGame(currentPlayer, newState.borneOff);
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
        lastMove: move, moveSeq: moveSeq + 1, selectedPoint: null, validDestinations: [], message: '',
      });

      if (!hasNextMoves) {
        if (newRemainingMoves.length > 0) set({ message: 'Kalan zarlar için hamle yok.' });
        set({ turnFinished: true });
      }
      persist();
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

      haptics.tap();
      set({
        board: currentState.board, bar: currentState.bar, borneOff: currentState.borneOff,
        remainingMoves: newRemainingMoves, moveHistory: newMoveHistory,
        lastMove: newMoveHistory.length > 0 ? newMoveHistory[newMoveHistory.length - 1] : null,
        selectedPoint: null, validDestinations: [], turnFinished: false, message: '',
      });
      persist();
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
        beginPlayerTurn();
      } else {
        set({ gamePhase: 'ai_thinking', message: 'Rakip düşünüyor...' });
        persist();   // yapay zeka henüz oynamadı: bu nokta kurallara uygun bir kayıt anı
        schedule(() => get().executeAITurn(), 800);
      }
    },

    // ─── YAPAY ZEKA TURU ─────────────────────────
    executeAITurn: () => {
      const { board, bar, borneOff, difficulty, currentPlayer } = get();

      // Tahtamız tamamen kapalıysa rakibin bar'daki taşı hiçbir zarla giremez;
      // zar atıp beklemenin anlamı yok, tur hızla geçilir.
      if (isClosedOut(board, bar, currentPlayer)) {
        set({ dice: null, remainingMoves: [], message: 'Tahta kapalı — rakip giremiyor.' });
        schedule(() => get().endTurn(), 900);
        return;
      }

      const dice = rollDiceUtil();
      const remainingMoves = getMovesFromDice(dice[0], dice[1]);
      set({ dice, remainingMoves, showDoublesIndicator: dice[0] === dice[1] });

      schedule(() => {
        let moves;
        try { moves = getAIMoves(board, bar, borneOff, currentPlayer, remainingMoves, difficulty); }
        catch (e) { moves = []; }

        if (!moves || moves.length === 0) {
          set({ message: 'Rakibin hamlesi yok.' });
          schedule(() => get().endTurn(), 1200);
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
            catch (e) { i++; schedule(applyNext, 300); return; }

            if (newState.hit) haptics.hit();

            set({
              board: newState.board, bar: newState.bar, borneOff: newState.borneOff,
              lastMove: move, moveSeq: get().moveSeq + 1,
            });

            const result = isGameOver(newState.borneOff);
            if (result.gameOver) { get().finishGame(s.currentPlayer, newState.borneOff); return; }

            i++;
            schedule(applyNext, 500);
          } else {
            schedule(() => get().endTurn(), 400);
          }
        };
        applyNext();
      }, 600);
    },

    // ─── OYUN SONU ───────────────────────────────
    finishGame: (winner, borneOff) => {
      const { playerColor, stats } = get();
      const win = getWinType(borneOff, winner);
      const playerWon = winner === playerColor;

      const newStats = {
        played: stats.played + 1,
        won: stats.won + (playerWon ? 1 : 0),
        lost: stats.lost + (playerWon ? 0 : 1),
        marsWon: stats.marsWon + (playerWon && win.type === 'mars' ? 1 : 0),
        marsLost: stats.marsLost + (!playerWon && win.type === 'mars' ? 1 : 0),
      };

      if (playerWon) haptics.win(); else haptics.lose();

      clearSavedGame();
      saveStats(newStats);
      set({
        gamePhase: 'game_over',
        winner,
        winType: win.type,
        winPoints: win.points,
        message: '',
        stats: newStats,
        hasSavedGame: false,
        isPaused: false,
      });
    },

    // ─── AYARLAR / İSTATİSTİK ────────────────────
    toggleHaptics: () => {
      const settings = { ...get().settings, haptics: !get().settings.haptics };
      setHapticsEnabled(settings.haptics);
      saveSettings(settings);
      set({ settings });
    },
    clearStats: async () => {
      const stats = await resetStats();
      set({ stats });
    },

    // ─── MENÜLER ─────────────────────────────────
    goToMenu: () => {
      // Devam eden oyun varsa kaydı korunur, menüden sürdürülebilir
      const { gamePhase } = get();
      const keepSave = gamePhase !== 'game_over' && gamePhase !== 'menu';
      if (keepSave) persist();

      set({
        gamePhase: 'menu', isPaused: false,
        board: createInitialBoard(),
        bar: { white: 0, black: 0 }, borneOff: { white: 0, black: 0 },
        currentPlayer: WHITE, playerColor: BLACK, dice: null,
        remainingMoves: [], selectedPoint: null, validDestinations: [],
        winner: null, winType: null, winPoints: 0,
        message: '', moveHistory: [], lastMove: null, moveSeq: 0,
        showDoublesIndicator: false, turnFinished: false, turnInitialState: null,
        openingDice: { player: null, ai: null }, openingRolling: false,
        hasSavedGame: keepSave,
      });
    },
    setDifficulty: (d) => set({ difficulty: d }),
    resetGame: () => get().startGame(get().difficulty),
  };
});

export default useGameStore;

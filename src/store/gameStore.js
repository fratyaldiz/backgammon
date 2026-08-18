import { create } from 'zustand';
import { WHITE, BLACK, rollDice as rollDiceUtil, rollDie, getMovesFromDice, DICE_SPIN_MS } from '../utils/diceUtils';
import {
  createInitialBoard, cloneGameState,
  getValidFirstMoves, applyMove,
  isGameOver, isClosedOut, getWinType
} from '../utils/gameLogic';
import { getAIMoves } from '../utils/aiPlayer';
import {
  saveGame, loadGame, clearSavedGame,
  loadStats, saveStats, resetStats,
  loadSettings, saveSettings,
  loadWallet, saveWallet
} from '../utils/storage';
import { haptics, setHapticsEnabled } from '../utils/feedback';
import { initSound, sfx, setSoundEnabled } from '../utils/sound';
import {
  getTable, canPlay, settlement, forfeitAmount,
  bonusStatus, BONUS_AMOUNT, STARTING_BALANCE
} from '../utils/economy';

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
    diceRolling: false,   // zar donme animasyonu
    autoSkipCount: 0,
    hasSavedGame: false,
    stats: { ...EMPTY_STATS },
    settings: { haptics: true, sound: true },
    balance: STARTING_BALANCE,
    lastBonusAt: null,
    tableId: 'medium',
    stake: 0,          // sürmekte olan oyunun bahsi
    lastPayout: 0,     // oyun sonu ekranında gösterilen kazanç/kayıp

    // ─── UYGULAMA AÇILIŞI ────────────────────────
    initApp: async () => {
      const [settings, stats, saved, wallet] = await Promise.all([
        loadSettings(), loadStats(), loadGame(), loadWallet(),
      ]);
      setHapticsEnabled(settings.haptics);
      setSoundEnabled(settings.sound);
      await initSound();
      set({
        settings, stats,
        hasSavedGame: !!saved,
        balance: wallet.balance,
        lastBonusAt: wallet.lastBonusAt,
        tableId: (saved && saved.tableId) || 'medium',
      });
    },

    // ─── 6 SAATLİK ÖDÜL ──────────────────────────
    claimBonus: () => {
      const { lastBonusAt, balance } = get();
      if (!bonusStatus(lastBonusAt).ready) return;

      const now = Date.now();
      const newBalance = balance + BONUS_AMOUNT;
      sfx.coin();
      haptics.bearOff();
      saveWallet({ balance: newBalance, lastBonusAt: now });
      set({ balance: newBalance, lastBonusAt: now });
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
        tableId: saved.tableId || 'medium',
        stake: saved.stake || getTable(saved.tableId || 'medium').bet,
        lastPayout: 0,
        selectedPoint: null,
        validDestinations: [],
        winner: null, winType: null, winPoints: 0,
        message: '', lastMove: null, moveSeq: 0,
        showDoublesIndicator: false,
        isPaused: false,
        openingDice: { player: null, ai: null },
        openingRolling: false,
        diceRolling: false,
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
    // tableId verilmezse mevcut masa kullanılır. Bakiye masanın gerektirdiği
    // düzeyin altındaysa oyun başlamaz.
    startGame: (difficulty, tableId) => {
      const state = get();
      const table = getTable(tableId || state.tableId || difficulty || 'medium');

      // Sürmekte olan oyun terk ediliyorsa bahis kaybedilmiş sayılır
      let balance = state.balance;
      const inProgress = state.gamePhase !== 'menu' && state.gamePhase !== 'game_over' && state.stake > 0;
      if (inProgress) {
        balance = Math.max(0, balance + forfeitAmount(state.stake));
      }

      if (!canPlay(balance, table)) {
        set({ balance, message: 'Bu masa için bakiyeniz yetersiz.' });
        saveWallet({ balance, lastBonusAt: state.lastBonusAt });
        return false;
      }

      saveWallet({ balance, lastBonusAt: state.lastBonusAt });
      clearSavedGame();
      set({
        balance,
        tableId: table.id,
        stake: table.bet,
        lastPayout: 0,
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
        difficulty: table.difficulty,
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
        diceRolling: false,
        autoSkipCount: 0,
        hasSavedGame: false,
      });
      return true;
    },

    // ─── AÇILIŞ ZARI (kim başlayacak?) ───────────
    // Her iki taraf birer zar atar; yüksek atan taraf yeni bir zarla oyuna
    // başlar. Eşitlikte atış tekrarlanır.
    rollOpeningDice: () => {
      const { gamePhase, openingRolling, playerColor } = get();
      if (gamePhase !== 'opening_roll' || openingRolling) return;

      const playerDie = rollDie();
      const aiDie = rollDie();
      haptics.roll(); sfx.dice();
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
      haptics.roll(); sfx.dice();

      // Zar dönerken sonuç gizlidir; "hamle yok" uyarısı da animasyon
      // bitmeden gösterilmez, aksi halde atışı önceden ele verir.
      set({
        dice, remainingMoves,
        gamePhase: 'moving',
        message: '',
        showDoublesIndicator: dice[0] === dice[1],
        turnFinished: false,
        diceRolling: true,
        autoSkipCount: 0,   // oyuncu tekrar zar atabildi
        turnInitialState: {
          board: [...board],
          bar: { ...bar },
          borneOff: { ...borneOff },
          remainingMoves: [...remainingMoves],
        },
      });

      schedule(() => {
        set({ diceRolling: false });
        const validMoves = getValidFirstMoves(board, bar, borneOff, currentPlayer, remainingMoves);
        if (validMoves.length === 0) {
          set({ message: 'Hamle yok! Turu bitirebilirsiniz.', turnFinished: true });
        }
        persist();
      }, DICE_SPIN_MS + 60);
    },

    // ─── DOKUNARAK OTOMATİK HAREKET ──────────────
    selectPoint: (pointIndex) => {
      const { board, bar, currentPlayer, playerColor, gamePhase, remainingMoves, borneOff, turnFinished, isPaused, diceRolling } = get();
      if (isPaused || diceRolling || gamePhase !== 'moving' || currentPlayer !== playerColor || turnFinished) return;

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
      const { board, bar, borneOff, currentPlayer, playerColor, gamePhase, remainingMoves, turnFinished, isPaused, diceRolling } = get();
      if (isPaused || diceRolling || gamePhase !== 'moving' || currentPlayer !== playerColor || turnFinished) return;

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

      if (newState.hit) { haptics.hit(); sfx.hit(); }
      else if (move.to === 'off') { haptics.bearOff(); sfx.bearOff(); }
      else { haptics.move(); sfx.move(); }

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

      haptics.tap(); sfx.tap();
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
        turnFinished: false, turnInitialState: null, diceRolling: false,
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
      haptics.roll(); sfx.dice();
      set({ dice, remainingMoves, showDoublesIndicator: dice[0] === dice[1], diceRolling: true });
      schedule(() => set({ diceRolling: false }), DICE_SPIN_MS + 60);

      // Yapay zeka hamlesine zar animasyonu bitmeden başlamaz; sonuç önce
      // görünür, kısa bir duraklamadan sonra taşlar oynanır.
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

            if (newState.hit) { haptics.hit(); sfx.hit(); } else sfx.move();

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
      }, DICE_SPIN_MS + 400);
    },

    // ─── OYUN SONU ───────────────────────────────
    finishGame: (winner, borneOff) => {
      const { playerColor, stats, stake, balance, lastBonusAt } = get();
      const win = getWinType(borneOff, winner);
      const playerWon = winner === playerColor;

      const newStats = {
        played: stats.played + 1,
        won: stats.won + (playerWon ? 1 : 0),
        lost: stats.lost + (playerWon ? 0 : 1),
        marsWon: stats.marsWon + (playerWon && win.type === 'mars' ? 1 : 0),
        marsLost: stats.marsLost + (!playerWon && win.type === 'mars' ? 1 : 0),
      };

      // Bahis hesaplaşması: mars iki kat. Masaya giriş bahsin iki katı bakiye
      // istediği için sonuç hiçbir zaman eksiye düşmez.
      const payout = settlement(stake, win.points, playerWon);
      const newBalance = Math.max(0, balance + payout);

      if (playerWon) { haptics.win(); sfx.win(); }
      else { haptics.lose(); sfx.lose(); }
      if (payout > 0) schedule(() => sfx.coin(), 700);

      clearSavedGame();
      saveStats(newStats);
      saveWallet({ balance: newBalance, lastBonusAt });
      set({
        gamePhase: 'game_over',
        winner,
        winType: win.type,
        winPoints: win.points,
        message: '',
        stats: newStats,
        balance: newBalance,
        lastPayout: payout,
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
    toggleSound: () => {
      const settings = { ...get().settings, sound: !get().settings.sound };
      setSoundEnabled(settings.sound);
      saveSettings(settings);
      set({ settings });
      if (settings.sound) sfx.tap();
    },
    setTable: (tableId) => {
      const table = getTable(tableId);
      sfx.tap();
      set({ tableId: table.id, difficulty: table.difficulty, message: '' });
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
        openingDice: { player: null, ai: null }, openingRolling: false, diceRolling: false,
        hasSavedGame: keepSave,
        stake: keepSave ? get().stake : 0,
      });
    },
    setDifficulty: (d) => set({ difficulty: d }),
    resetGame: () => get().startGame(get().difficulty, get().tableId),
  };
});

export default useGameStore;

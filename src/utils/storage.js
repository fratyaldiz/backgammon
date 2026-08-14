import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVE_KEY = 'tavla.savedGame.v1';
const STATS_KEY = 'tavla.stats.v1';
const SETTINGS_KEY = 'tavla.settings.v1';

// Kayıt biçimi değişirse eski kayıtlar sessizce atılır.
const SAVE_VERSION = 1;

/**
 * Yalnızca oyunu sürdürmek için gereken alanlar saklanır. Geçici arayüz
 * durumları (sürükleme, açılış zarı animasyonu, mesaj) kayda girmez.
 */
export function serializeGame(s) {
  return {
    v: SAVE_VERSION,
    savedAt: Date.now(),
    board: s.board,
    bar: s.bar,
    borneOff: s.borneOff,
    currentPlayer: s.currentPlayer,
    playerColor: s.playerColor,
    dice: s.dice,
    remainingMoves: s.remainingMoves,
    gamePhase: s.gamePhase,
    difficulty: s.difficulty,
    turnFinished: s.turnFinished,
    turnInitialState: s.turnInitialState,
    moveHistory: s.moveHistory,
    autoSkipCount: s.autoSkipCount,
  };
}

function isValidSave(d) {
  return !!d
    && d.v === SAVE_VERSION
    && Array.isArray(d.board) && d.board.length === 24
    && d.bar && d.borneOff
    && typeof d.currentPlayer === 'number'
    && typeof d.gamePhase === 'string'
    && d.gamePhase !== 'menu' && d.gamePhase !== 'game_over';
}

export async function saveGame(state) {
  try {
    await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(serializeGame(state)));
  } catch (e) {
    // Kayıt başarısız olsa da oyun akışı kesilmez
  }
}

export async function loadGame() {
  try {
    const raw = await AsyncStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return isValidSave(data) ? data : null;
  } catch (e) {
    return null;
  }
}

export async function clearSavedGame() {
  try {
    await AsyncStorage.removeItem(SAVE_KEY);
  } catch (e) {
    // yoksay
  }
}

// ─── İstatistikler ───────────────────────────────
const EMPTY_STATS = { played: 0, won: 0, lost: 0, marsWon: 0, marsLost: 0 };

export async function loadStats() {
  try {
    const raw = await AsyncStorage.getItem(STATS_KEY);
    if (!raw) return { ...EMPTY_STATS };
    const d = JSON.parse(raw);
    return { ...EMPTY_STATS, ...d };
  } catch (e) {
    return { ...EMPTY_STATS };
  }
}

export async function saveStats(stats) {
  try {
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    // yoksay
  }
}

export async function resetStats() {
  try {
    await AsyncStorage.removeItem(STATS_KEY);
  } catch (e) {
    // yoksay
  }
  return { ...EMPTY_STATS };
}

// ─── Ayarlar ─────────────────────────────────────
const DEFAULT_SETTINGS = { haptics: true };

export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings) {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    // yoksay
  }
}

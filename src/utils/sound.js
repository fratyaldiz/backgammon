import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

/**
 * Ses efektleri. Her efekt için birden çok oynatıcı tutulur (havuz), böylece
 * arka arkaya gelen sesler birbirini kesmez — örneğin çift zarda dört hamle
 * peş peşe oynanırken taş sesi her seferinde duyulur.
 */
const SOURCES = {
  dice: require('../../assets/sounds/dice.wav'),
  move: require('../../assets/sounds/move.wav'),
  hit: require('../../assets/sounds/hit.wav'),
  bearOff: require('../../assets/sounds/bearoff.wav'),
  coin: require('../../assets/sounds/coin.wav'),
  win: require('../../assets/sounds/win.wav'),
  lose: require('../../assets/sounds/lose.wav'),
  tap: require('../../assets/sounds/tap.wav'),
};

// Üst üste binebilen kısa sesler için daha geniş havuz
const POOL_SIZE = { move: 3, hit: 2, tap: 2, bearOff: 2 };
const VOLUME = { dice: 0.9, move: 0.7, hit: 0.95, bearOff: 0.7, coin: 0.8, win: 0.85, lose: 0.8, tap: 0.4 };

let enabled = true;
let ready = false;
const pools = {};
const cursor = {};

export function setSoundEnabled(v) {
  enabled = !!v;
}

export async function initSound() {
  if (ready) return;
  try {
    // Sessize alma anahtarı açıkken de çalsın, diğer sesleri kesmesin
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'mixWithOthers',
    });
  } catch (e) {
    // Ses kipi ayarlanamazsa varsayılanla devam edilir
  }

  try {
    for (const key of Object.keys(SOURCES)) {
      const size = POOL_SIZE[key] || 1;
      pools[key] = [];
      cursor[key] = 0;
      for (let i = 0; i < size; i++) {
        const p = createAudioPlayer(SOURCES[key]);
        p.volume = VOLUME[key] != null ? VOLUME[key] : 0.8;
        pools[key].push(p);
      }
    }
    ready = true;
  } catch (e) {
    ready = false;   // ses yüklenemezse oyun sessiz çalışır
  }
}

function play(key) {
  if (!enabled || !ready) return;
  const pool = pools[key];
  if (!pool || pool.length === 0) return;
  try {
    const p = pool[cursor[key]];
    cursor[key] = (cursor[key] + 1) % pool.length;
    p.seekTo(0);
    p.play();
  } catch (e) {
    // Tek bir sesin çalmaması oyunu etkilemez
  }
}

export const sfx = {
  dice: () => play('dice'),
  move: () => play('move'),
  hit: () => play('hit'),
  bearOff: () => play('bearOff'),
  coin: () => play('coin'),
  win: () => play('win'),
  lose: () => play('lose'),
  tap: () => play('tap'),
};

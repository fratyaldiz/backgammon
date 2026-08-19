import { WHITE, BLACK } from './diceUtils';
import {
  cloneGameState,
  getValidMovesForState,
  applyMove,
  getAllLegalTurnSequences
} from './gameLogic';

// ─────────────────────────────────────────────────────────────
// Zar kombinasyonları (21 benzersiz atış ve olasılıkları)
// ─────────────────────────────────────────────────────────────
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

// Uzaklığa göre 36 atıştan kaçının vurabildiği (klasik "shot" tablosu)
const SHOT_TABLE = {
  1: 11, 2: 12, 3: 14, 4: 15, 5: 15, 6: 17,
  7: 6, 8: 6, 9: 5, 10: 3, 11: 2, 12: 3,
  15: 1, 16: 1, 18: 1, 20: 1, 24: 1,
};

// Performans sınırları
const AI_MAX_STATES = 600;        // easy/medium: puanlanacak benzersiz sonuç
const AI_HARD_CANDIDATES = 10;    // hard: statik elemeden sonra derin bakılacak aday
const AI_HARD_REPLY_CAP = 24;     // hard: her zar kombinasyonu için rakip cevabı
const AI_HARD_MAX_STATES = 220;   // hard: ön eleme havuzu

// ─────────────────────────────────────────────────────────────
// Durum yardımcıları
// ─────────────────────────────────────────────────────────────
function safeCloneState(board, bar, borneOff) {
  try {
    const cloned = cloneGameState(board, bar, borneOff);
    if (cloned && cloned.board) return cloned;
    if (cloned && cloned.state && cloned.state.board) return cloned.state;
  } catch (e) {
    // Ignore and use manual clone
  }
  return { board: [...board], bar: { ...bar }, borneOff: { ...borneOff } };
}

function applySequence(board, bar, borneOff, moves, player) {
  let currentState = safeCloneState(board, bar, borneOff);
  for (const move of moves) {
    const nextState = applyMove(currentState.board, currentState.bar, currentState.borneOff, move, player);
    if (nextState && nextState.board) currentState = nextState;
  }
  return currentState;
}

function stateSignature(state) {
  return state.board.join(',')
    + '|' + (state.bar.white || 0) + ',' + (state.bar.black || 0)
    + '|' + (state.borneOff.white || 0) + ',' + (state.borneOff.black || 0);
}

/**
 * Sekansları nihai duruma göre tekilleştirir (permütasyonlar tek temsilciye iner)
 * ve cap'e ulaşınca durur. Döner: [{ seq, state }]
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
 * Rakip cevap durumları: sekans listesi üretmeden doğrudan benzersiz
 * nihai durumları toplar. Düğüm tekrarları elenir, en fazla zar kullanan
 * dallar tercih edilir. Arama içinde çağrıldığı için hız kritiktir.
 */
function collectReplyStates(board, bar, borneOff, player, dice, cap) {
  const terminals = [];
  const visited = new Set();
  const stack = [{ b: board, br: bar, bo: borneOff, rem: dice, depth: 0 }];
  let maxDepth = 0;
  let guard = 0;

  while (stack.length > 0) {
    if (++guard > 4000 || terminals.length > cap * 6) break;
    const node = stack.pop();

    const nodeKey = node.depth + '#' + node.b.join(',')
      + '|' + node.br.white + ',' + node.br.black
      + '|' + node.bo.white + ',' + node.bo.black;
    if (visited.has(nodeKey)) continue;
    visited.add(nodeKey);

    if (node.rem.length === 0) {
      terminals.push({ state: { board: node.b, bar: node.br, borneOff: node.bo }, depth: node.depth });
      if (node.depth > maxDepth) maxDepth = node.depth;
      continue;
    }

    const moves = getValidMovesForState(node.b, node.br, node.bo, player, node.rem);
    if (moves.length === 0) {
      terminals.push({ state: { board: node.b, bar: node.br, borneOff: node.bo }, depth: node.depth });
      if (node.depth > maxDepth) maxDepth = node.depth;
      continue;
    }

    for (const m of moves) {
      const ns = applyMove(node.b, node.br, node.bo, m, player);
      const nextRem = [...node.rem];
      const di = nextRem.indexOf(m.dieValue);
      if (di !== -1) nextRem.splice(di, 1);
      stack.push({ b: ns.board, br: ns.bar, bo: ns.borneOff, rem: nextRem, depth: node.depth + 1 });
    }
  }

  // En fazla zar kullanan dallar (tavla kuralı) + benzersizleştirme
  const out = [];
  const seen = new Set();
  for (const t of terminals) {
    if (t.depth < maxDepth) continue;
    const sig = stateSignature(t.state);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(t.state);
    if (out.length >= cap) break;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// UZMAN DEĞERLENDİRME
// Simetrik kurulur: evaluateExpert(state, P) === -evaluateExpert(state, rakip)
// Bu sayede rakibin en iyi cevabı = bizim skorumuzun minimumu.
// ─────────────────────────────────────────────────────────────
const _mine = new Array(24);
const _theirs = new Array(24);

// Değerlendirme ağırlıkları (pip birimi cinsinden, kafa kafaya maçlarla ayarlandı)
const W = {
  contactPip: 0.72,      // temas oyununda pip farkı (yapı daha önemli)
  borneOff: 3.5,
  barBase: 7.0,
  barPerHomePoint: 4.0,
  homePoint: 5.0,
  homePointVsBar: 4.5,
  prime: 3.5,
  escapeDenial: 9.0,     // rakip geri taşının kapalı çıkış zarları
  anchor: 1.0,           // anchor değer tablosunun genel çarpanı
  backCheckerExcess: 4.0,
  stackWaste: 1.8,
  deepWaste: 2.2,        // ev derinliğinde israf edilen fazla taş
  builder: 1.6,          // yapı kurmaya aday yedek taşlar
  pointsMade: 1.5,
  homeGap: 2.0,          // toplamaya hazırlanırken evdeki boşluklar
};

// Oyuncunun perspektifinden bir indeksin pip değeri
function pipOf(idx, player) {
  return player === WHITE ? (idx + 1) : (24 - idx);
}

// Rakip evindeki anchor'ın değeri, tuttuğu noktaya göre keskin değişir.
// Rakibin 1-noktası hiçbir şeyi engellemez; 5-noktası (altın nokta) en değerlisidir.
// Dizin = rakibin nokta numarası (1..6).
const ANCHOR_VALUE = [0, 0.5, 2.0, 4.5, 7.0, 11.0, 9.0];

/**
 * Bir blot'a kaç atışın vurabildiğini tahmin eder.
 * Doğrudan atışlar tablodan; dolaylı atışlar ara nokta kapalıysa iskonto edilir.
 * Saldırganlar bağımsız varsayılıp birleşik vurulma olasılığı hesaplanır.
 */
function hitProbability(blotIdx, defender, board, bar) {
  // defender: blot'un sahibi. Saldıran = rakip.
  const attackerIsWhite = defender === BLACK;
  let missProb = 1;

  // Bar'daki saldırgan: WHITE 24'ten, BLACK -1'den giriyormuş gibi
  const attackerBarCount = attackerIsWhite ? (bar.white || 0) : (bar.black || 0);
  if (attackerBarCount > 0) {
    const d = attackerIsWhite ? (24 - blotIdx) : (blotIdx + 1);
    const s = SHOT_TABLE[d] || 0;
    if (s > 0) missProb *= (1 - (s * 0.55) / 36); // bar'dan önce girmek gerekir
  }

  for (let j = 0; j < 24; j++) {
    const v = board[j];
    const attackerCount = attackerIsWhite ? (v > 0 ? v : 0) : (v < 0 ? -v : 0);
    if (attackerCount === 0) continue;

    // WHITE azalan yönde, BLACK artan yönde ilerler
    const d = attackerIsWhite ? (j - blotIdx) : (blotIdx - j);
    if (d <= 0 || d > 24) continue;

    let s = SHOT_TABLE[d] || 0;
    if (s === 0) continue;

    // Dolaylı atışlarda (d > 6) ara noktaların kapalılığı iskonto yaratır
    if (d > 6) {
      let blocked = 0, checked = 0;
      for (let step = 1; step <= 6; step++) {
        const mid = attackerIsWhite ? (j - step) : (j + step);
        if (mid < 0 || mid > 23 || mid === blotIdx) continue;
        checked++;
        const mv = board[mid];
        const defCount = defender === WHITE ? (mv > 0 ? mv : 0) : (mv < 0 ? -mv : 0);
        if (defCount >= 2) blocked++;
      }
      if (checked > 0) s *= (1 - 0.75 * (blocked / checked));
    }

    missProb *= (1 - s / 36);
  }

  return 1 - missProb;
}

function evaluateExpert(board, bar, borneOff, player) {
  const opp = player === WHITE ? BLACK : WHITE;
  const myBar = player === WHITE ? (bar.white || 0) : (bar.black || 0);
  const oppBar = player === WHITE ? (bar.black || 0) : (bar.white || 0);
  const myOff = player === WHITE ? (borneOff.white || 0) : (borneOff.black || 0);
  const oppOff = player === WHITE ? (borneOff.black || 0) : (borneOff.white || 0);

  // Kazanma/kaybetme terminalleri
  if (myOff >= 15) return 10000;
  if (oppOff >= 15) return -10000;

  let myPips = myBar * 25, oppPips = oppBar * 25;
  let myHomePoints = 0, oppHomePoints = 0;
  let myMaxIdx = -1, myMinIdx = 24, oppMaxIdx = -1, oppMinIdx = 24;
  let myCheckersOnBoard = 0, oppCheckersOnBoard = 0;
  let myHomeCheckers = 0, oppHomeCheckers = 0;

  for (let i = 0; i < 24; i++) {
    const v = board[i];
    const m = player === WHITE ? (v > 0 ? v : 0) : (v < 0 ? -v : 0);
    const t = player === WHITE ? (v < 0 ? -v : 0) : (v > 0 ? v : 0);
    _mine[i] = m;
    _theirs[i] = t;

    if (m > 0) {
      myCheckersOnBoard += m;
      myPips += m * (player === WHITE ? (i + 1) : (24 - i));
      if (i > myMaxIdx) myMaxIdx = i;
      if (i < myMinIdx) myMinIdx = i;
    }
    if (t > 0) {
      oppCheckersOnBoard += t;
      oppPips += t * (opp === WHITE ? (i + 1) : (24 - i));
      if (i > oppMaxIdx) oppMaxIdx = i;
      if (i < oppMinIdx) oppMinIdx = i;
    }
  }

  // Ev bölgeleri: WHITE 0-5, BLACK 18-23
  const myHomeStart = player === WHITE ? 0 : 18;
  const oppHomeStart = opp === WHITE ? 0 : 18;
  let myBackCheckers = 0, oppBackCheckers = 0;
  for (let k = 0; k < 6; k++) {
    if (_mine[myHomeStart + k] >= 2) myHomePoints++;
    if (_theirs[oppHomeStart + k] >= 2) oppHomePoints++;
    myHomeCheckers += _mine[myHomeStart + k];
    oppHomeCheckers += _theirs[oppHomeStart + k];
    // Rakip evindeki kendi taşlarım = geri taşlarım
    myBackCheckers += _mine[oppHomeStart + k];
    oppBackCheckers += _theirs[myHomeStart + k];
  }

  // Toplama aşamasına geçildi mi? (taşlar eve doldu, gömme artık israf değil)
  const myBearingIn = myBar === 0 && (myCheckersOnBoard - myHomeCheckers) <= 3;
  const oppBearingIn = oppBar === 0 && (oppCheckersOnBoard - oppHomeCheckers) <= 3;

  // Temas var mı? (WHITE azalan, BLACK artan → yüksek WHITE indeksi düşük BLACK indeksini geçiyorsa temas)
  let contact;
  if (myBar > 0 || oppBar > 0) {
    contact = true;
  } else if (player === WHITE) {
    contact = myMaxIdx > oppMinIdx;
  } else {
    contact = oppMaxIdx > myMinIdx;
  }

  let score = 0;

  // ── 1. Toplanan taş ──
  score += (myOff - oppOff) * W.borneOff;

  // ── SAF YARIŞ (temas yok): pip farkının değeri kalan mesafeye göre büyür ──
  if (!contact) {
    // 20 pip önde olmak, 300 pip kalmışken küçük; 40 pip kalmışken kazançtır.
    const raceScale = 1.0 + 140 / (myPips + oppPips + 40);
    score += (oppPips - myPips) * raceScale;

    // Boşa harcanan pip: aşırı yığılma ve çeyrek geçişleri
    let myWaste = 0, oppWaste = 0, myCross = 0, oppCross = 0;
    for (let i = 0; i < 24; i++) {
      if (_mine[i] > 3) myWaste += (_mine[i] - 3) * 1.5;
      if (_theirs[i] > 3) oppWaste += (_theirs[i] - 3) * 1.5;
      if (_mine[i] > 0) {
        const q = player === WHITE ? Math.floor(i / 6) : Math.floor((23 - i) / 6);
        myCross += _mine[i] * q;
      }
      if (_theirs[i] > 0) {
        const q = opp === WHITE ? Math.floor(i / 6) : Math.floor((23 - i) / 6);
        oppCross += _theirs[i] * q;
      }
    }
    score += (oppWaste - myWaste);
    score += (oppCross - myCross) * 1.2;
    score += (myHomePoints - oppHomePoints) * 0.5;
    return score;
  }

  // ── TEMAS OYUNU ──

  // 2. Pip yarışı (temasta yapı daha belirleyici olduğu için düşük ağırlık)
  score += (oppPips - myPips) * W.contactPip;

  // 3. Kırık taş: rakip evi güçlüyse çok daha pahalı
  score -= myBar * (W.barBase + oppHomePoints * W.barPerHomePoint);
  score += oppBar * (W.barBase + myHomePoints * W.barPerHomePoint);

  // 4. Blot riski (vurulma olasılığı × kaybedilecek pip × ev gücü çarpanı)
  // Vurulmanın bedeli kaybedilen pip ile orantılıdır: rakip evinin dibindeki
  // blot 1 pip kaybettirir, neredeyse bedavadır. Sabit terim küçük tutulur;
  // asıl ek maliyet rakip ev tahtası güçlüyse (bar'da kalma riski) doğar.
  let myBlotRisk = 0, oppBlotRisk = 0;
  for (let i = 0; i < 24; i++) {
    if (_mine[i] === 1) {
      const p = hitProbability(i, player, board, bar);
      const pipsLost = 25 - (player === WHITE ? (i + 1) : (24 - i));
      myBlotRisk += p * (pipsLost * 0.9 + 2.0 + oppHomePoints * 3.0);
    }
    if (_theirs[i] === 1) {
      const p = hitProbability(i, opp, board, bar);
      const pipsLost = 25 - (opp === WHITE ? (i + 1) : (24 - i));
      oppBlotRisk += p * (pipsLost * 0.9 + 2.0 + myHomePoints * 3.0);
    }
  }
  score -= myBlotRisk;
  score += oppBlotRisk;

  // 5. Ev tahtası gücü — rakip kırıkken katlanır (blitz)
  score += (myHomePoints - oppHomePoints) * W.homePoint;
  score += myHomePoints * oppBar * W.homePointVsBar;
  score -= oppHomePoints * myBar * W.homePointVsBar;

  // 6. Prime (ardışık kapalı noktalar)
  let myRun = 0, oppRun = 0, myPrime = 0, oppPrime = 0;
  for (let i = 0; i < 24; i++) {
    myRun = _mine[i] >= 2 ? myRun + 1 : 0;
    oppRun = _theirs[i] >= 2 ? oppRun + 1 : 0;
    if (myRun > myPrime) myPrime = myRun;
    if (oppRun > oppPrime) oppPrime = oppRun;
  }
  const primeValue = (n) => (n < 3 ? 0 : (n - 2) * (n - 2) * W.prime);
  score += primeValue(myPrime) - primeValue(oppPrime);

  // 7. Kaçış engelleme: rakibin en geri taşının 6 zarından kaçı kapalı?
  //    Doğrudan "kaçış zarı reddi" ölçer; kaba blok sayımından çok daha keskin.
  const oppBackIdx = opp === WHITE ? oppMaxIdx : oppMinIdx;
  const myBackIdx = player === WHITE ? myMaxIdx : myMinIdx;
  let myDenial = 0, oppDenial = 0;
  if (oppBackIdx >= 0 && oppBackIdx <= 23) {
    let blocked = 0;
    for (let d = 1; d <= 6; d++) {
      const idx = opp === WHITE ? oppBackIdx - d : oppBackIdx + d;
      if (idx < 0 || idx > 23) continue;   // dışarı çıkış = kaçış değil, toplama
      if (_mine[idx] >= 2) blocked++;
    }
    myDenial = blocked / 6;
  }
  if (myBackIdx >= 0 && myBackIdx <= 23) {
    let blocked = 0;
    for (let d = 1; d <= 6; d++) {
      const idx = player === WHITE ? myBackIdx - d : myBackIdx + d;
      if (idx < 0 || idx > 23) continue;
      if (_theirs[idx] >= 2) blocked++;
    }
    oppDenial = blocked / 6;
  }
  score += (myDenial - oppDenial) * W.escapeDenial;

  // 8. Rakip evindeki anchor (2+ taş) — değeri tutulan noktaya göre değişir
  let myAnchors = 0, oppAnchors = 0;
  for (let k = 0; k < 6; k++) {
    const myIdx = oppHomeStart + k;   // rakibin evi = benim anchor bölgem
    const oppIdx = myHomeStart + k;
    if (_mine[myIdx] >= 2) myAnchors += ANCHOR_VALUE[pipOf(myIdx, opp)] * W.anchor;
    if (_theirs[oppIdx] >= 2) oppAnchors += ANCHOR_VALUE[pipOf(oppIdx, player)] * W.anchor;
  }
  score += myAnchors - oppAnchors;

  // 9. Sıkışmış geri taşlar (rakip evinde 2'den fazla taş yük)
  if (myBackCheckers > 2) score -= (myBackCheckers - 2) * W.backCheckerExcess;
  if (oppBackCheckers > 2) score += (oppBackCheckers - 2) * W.backCheckerExcess;

  // 10. Taş dağılımı: yığılma israfı, ev derinliğinde ölü taşlar, aktif yapıcılar
  let myWaste = 0, oppWaste = 0;
  let myDeep = 0, oppDeep = 0;
  let myBuilders = 0, oppBuilders = 0;
  let myPoints = 0, oppPoints = 0;
  for (let i = 0; i < 24; i++) {
    const m = _mine[i], t = _theirs[i];
    if (m >= 2) myPoints++;
    if (t >= 2) oppPoints++;
    // 5 taşlı nokta normaldir (açılışta 13 ve 6 noktaları böyle); 6'ncıdan sonrası israf
    if (m > 4) myWaste += (m - 4) * W.stackWaste;
    if (t > 4) oppWaste += (t - 4) * W.stackWaste;

    const myPip = pipOf(i, player);
    const oppPip = pipOf(i, opp);
    // Toplama başlamadan 1-2 noktalarına gömülen taş oyun dışıdır
    if (!myBearingIn && myPip <= 2) myDeep += m * W.deepWaste;
    if (!oppBearingIn && oppPip <= 2) oppDeep += t * W.deepWaste;
    // 1-3 noktalarındaki fazla taş da yapıya katkı vermez
    if (m > 2 && myPip <= 3) myDeep += (m - 2) * W.deepWaste;
    if (t > 2 && oppPip <= 3) oppDeep += (t - 2) * W.deepWaste;
    // 7-13 pip aralığındaki yedekler yeni nokta kurmaya adaydır
    if (m > 2 && myPip >= 7 && myPip <= 13) myBuilders += (m - 2) * W.builder;
    if (t > 2 && oppPip >= 7 && oppPip <= 13) oppBuilders += (t - 2) * W.builder;
  }
  score += (oppWaste - myWaste) + (oppDeep - myDeep) + (myBuilders - oppBuilders);
  score += (myPoints - oppPoints) * W.pointsMade;

  // 11. Toplamaya hazırlık: yalnızca taşlar eve dolduğunda boşluklar maliyetlidir
  if (myBearingIn) {
    let gaps = 0;
    for (let k = 0; k < 6; k++) if (_mine[myHomeStart + k] === 0) gaps++;
    score -= gaps * W.homeGap;
  }
  if (oppBearingIn) {
    let gaps = 0;
    for (let k = 0; k < 6; k++) if (_theirs[oppHomeStart + k] === 0) gaps++;
    score += gaps * W.homeGap;
  }

  return score;
}

// ─────────────────────────────────────────────────────────────
// EASY: rastgele geçerli sekans
// ─────────────────────────────────────────────────────────────
function getEasyMove(outcomes) {
  return outcomes[Math.floor(Math.random() * outcomes.length)].seq;
}

// ─────────────────────────────────────────────────────────────
// MEDIUM: basit sezgisel puanlama (kasıtlı olarak sınırlı)
// ─────────────────────────────────────────────────────────────
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

  return bestSequences[Math.floor(Math.random() * bestSequences.length)];
}

function scoreMediumSequence(initialBoard, initialBar, initialBorneOff, finalState, player) {
  let score = 0;
  const opponent = player === WHITE ? BLACK : WHITE;
  const oppBarKey = opponent === WHITE ? 'white' : 'black';
  const playerBarKey = player === WHITE ? 'white' : 'black';

  const hits = (finalState.bar[oppBarKey] || 0) - (initialBar[oppBarKey] || 0);
  if (hits > 0) score += hits * 5;

  const borneOffCount = (finalState.borneOff[playerBarKey] || 0) - (initialBorneOff[playerBarKey] || 0);
  if (borneOffCount > 0) score += borneOffCount * 4;

  for (let i = 0; i < 24; i++) {
    const initialCheckers = initialBoard[i];
    const finalCheckers = finalState.board[i];

    const initialPlayerCount = (player === WHITE && initialCheckers > 0) ? initialCheckers : (player === BLACK && initialCheckers < 0) ? -initialCheckers : 0;
    const finalPlayerCount = (player === WHITE && finalCheckers > 0) ? finalCheckers : (player === BLACK && finalCheckers < 0) ? -finalCheckers : 0;

    if (initialPlayerCount < 2 && finalPlayerCount >= 2) {
      score += 3;
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

    if (initialPlayerCount !== 1 && finalPlayerCount === 1) {
      score -= 4;
      const inOppHome = (player === WHITE && i >= 18 && i <= 23) || (player === BLACK && i >= 0 && i <= 5);
      if (inOppHome) score -= 2;
    }

    const inHome = (player === WHITE && i >= 0 && i <= 5) || (player === BLACK && i >= 18 && i <= 23);
    if (inHome && finalPlayerCount > initialPlayerCount) {
      score += 2 * (finalPlayerCount - initialPlayerCount);
    }

    const isInOppHome = (player === WHITE && i >= 18 && i <= 23) || (player === BLACK && i >= 0 && i <= 5);
    if (isInOppHome && initialPlayerCount > finalPlayerCount) {
      score += 2 * (initialPlayerCount - finalPlayerCount);
    }
  }

  return score;
}

// ─────────────────────────────────────────────────────────────
// HARD: uzman değerlendirme + 1 ply expectiminimax
// Aday hamleler statik değerlendirmeyle elenir, kalanlar 21 zar
// kombinasyonu üzerinden rakibin en iyi cevabına karşı sınanır.
// ─────────────────────────────────────────────────────────────
function getHardMove(board, bar, borneOff, player, outcomes) {
  const opponent = player === WHITE ? BLACK : WHITE;

  // Tek seçenek varsa arama yapma
  if (outcomes.length === 1) return outcomes[0].seq;

  // 1) Statik ön eleme
  const scored = outcomes.map(o => ({
    seq: o.seq,
    state: o.state,
    staticScore: evaluateExpert(o.state.board, o.state.bar, o.state.borneOff, player),
  }));
  scored.sort((a, b) => b.staticScore - a.staticScore);

  // Terminal kazanç varsa doğrudan oyna
  if (scored[0].staticScore >= 10000) return scored[0].seq;

  const candidates = scored.slice(0, Math.min(AI_HARD_CANDIDATES, scored.length));

  // 2) Her aday için beklenen değer (rakip en iyi cevabı oynar)
  let bestValue = -Infinity;
  let bestSequences = [];

  for (const cand of candidates) {
    const s = cand.state;
    let expected = 0;

    for (const combo of DICE_COMBINATIONS) {
      const replies = collectReplyStates(s.board, s.bar, s.borneOff, opponent, combo.roll, AI_HARD_REPLY_CAP);

      // Zar dağılımı üzerinden ortalanan büyüklük kazanma olasılığıdır.
      // Ham skor değerle doğrusal değildir; onu ortalamak, uç konumları
      // olduğundan ağır gösterip riskli hamleleri yanlış değerlendirir.
      let worstForUs;
      if (replies.length === 0) {
        worstForUs = winProbability(s.board, s.bar, s.borneOff, player);
      } else {
        worstForUs = Infinity;
        for (const r of replies) {
          // Değerlendirme simetrik: bizim olasılığımızın minimumu = rakibin en iyisi
          const v = winProbability(r.board, r.bar, r.borneOff, player);
          if (v < worstForUs) worstForUs = v;
        }
      }

      expected += worstForUs * combo.prob;
    }

    // Statik skoru çok küçük ağırlıkla kat: eşitlik bozucu, yapısal tercihleri
    // korur. Olasılık 0-1 aralığında olduğu için ağırlık da ona göre küçüktür.
    const value = expected + cand.staticScore * 0.0002;

    if (value > bestValue + 1e-9) {
      bestValue = value;
      bestSequences = [cand.seq];
    } else if (Math.abs(value - bestValue) <= 1e-9) {
      bestSequences.push(cand.seq);
    }
  }

  return bestSequences[Math.floor(Math.random() * bestSequences.length)];
}

// ─────────────────────────────────────────────────────────────
// Giriş noktası
// ─────────────────────────────────────────────────────────────
export function getAIMoves(board, bar, borneOff, player, dice, difficulty = 'easy') {
  const sequences = getAllLegalTurnSequences(board, bar, borneOff, player, dice);

  if (!sequences || sequences.length === 0 || (sequences.length === 1 && sequences[0].length === 0)) {
    return [];
  }

  const cap = difficulty === 'hard' ? AI_HARD_MAX_STATES : AI_MAX_STATES;
  const outcomes = uniqueOutcomes(board, bar, borneOff, sequences, player, cap);
  if (outcomes.length === 0) return [];

  let chosen;
  switch (difficulty) {
    case 'medium':
      chosen = getMediumMove(board, bar, borneOff, player, outcomes);
      break;
    case 'hard':
      chosen = getHardMove(board, bar, borneOff, player, outcomes);
      break;
    case 'easy':
    default:
      chosen = getEasyMove(outcomes);
      break;
  }

  // Güvenlik ağı: seçim başarısız olursa geçerli ilk sekansa düş
  return Array.isArray(chosen) ? chosen : outcomes[0].seq;
}

// Değerlendirme fonksiyonu ve ağırlıkları: test/ayar araçları için dışa açık
export { evaluateExpert, W as EVAL_WEIGHTS };

// ─────────────────────────────────────────────────────────────
// KAZANMA OLASILIĞI
//
// Konum skoru tek başına bahis kararı vermeye yetmez; skorun kazanma
// olasılığına çevrilmesi gerekir. Katsayılar uzman AI'ın kendi kendine
// oynadığı yüzlerce oyundan toplanan örneklerle uydurulmuştur (lojistik
// regresyon). Temas oyunu ile saf yarış ayrı ayrı kalibre edilir, çünkü
// skorun ölçeği bu iki evrede farklıdır.
// ─────────────────────────────────────────────────────────────
// 300 kendi kendine oyun, 4578 örnekle uyduruldu.
//
// Sabit terim bilerek sıfırdır: oyun simetrik olduğuna göre bir konumun
// iki taraf için olasılıkları toplamı 1 etmelidir. Skor da simetrik
// olduğundan (skor(P) = -skor(rakip)) bu ancak sabit terim sıfırken
// sağlanır. Uydurmada çıkan küçük sapma veri dengesizliğinden gelir ve
// bırakılırsa iki taraf da kendini favori sanabilir.
const WIN_PROB_COEF = {
  contact: { w1: 0.019677 },
  race: { w1: 0.056114 },
};

function hasContactNow(board, bar) {
  if ((bar.white || 0) > 0 || (bar.black || 0) > 0) return true;
  let maxW = -1, minB = 24;
  for (let i = 0; i < 24; i++) {
    if (board[i] > 0 && i > maxW) maxW = i;
    if (board[i] < 0 && i < minB) minB = i;
  }
  return maxW > minB;
}

/** Konumun anlık kazanma olasılığı (0-1), ileriye bakmadan. */
export function winProbability(board, bar, borneOff, player) {
  const score = evaluateExpert(board, bar, borneOff, player);
  const c = hasContactNow(board, bar) ? WIN_PROB_COEF.contact : WIN_PROB_COEF.race;
  const p = 1 / (1 + Math.exp(-c.w1 * score));
  return Math.min(Math.max(p, 0.01), 0.99);
}

/**
 * İleriye bakan kazanma olasılığı.
 *
 * Bahis kararı anlık görüntüyle verilemez: sıradaki atış konumu tümüyle
 * değiştirebilir. Bu yüzden 21 zar kombinasyonunun tamamı denenir, her
 * biri için sıradaki tarafın en iyi cevabı bulunur ve sonuçların olasılıkla
 * ağırlıklı ortalaması alınır.
 *
 * nextToRoll: sırası gelen taraf. Katlama teklifi kendi turumuzda zar
 * atmadan önce yapıldığından, teklifi değerlendirirken sırayı atacak olan
 * taraf hesaba katılmalıdır.
 */
export function lookaheadWinProbability(board, bar, borneOff, player, nextToRoll) {
  let expected = 0;

  for (const combo of DICE_COMBINATIONS) {
    const replies = collectReplyStates(board, bar, borneOff, nextToRoll, combo.roll, CUBE_REPLY_CAP);

    let value;
    if (replies.length === 0) {
      value = winProbability(board, bar, borneOff, player);
    } else if (nextToRoll === player) {
      // Sıra bizde: en iyi sonucu seçeriz
      value = -Infinity;
      for (const r of replies) {
        const v = winProbability(r.board, r.bar, r.borneOff, player);
        if (v > value) value = v;
      }
    } else {
      // Sıra rakipte: bizim için en kötüsünü seçer
      value = Infinity;
      for (const r of replies) {
        const v = winProbability(r.board, r.bar, r.borneOff, player);
        if (v < value) value = v;
      }
    }

    expected += value * combo.prob;
  }

  return Math.min(Math.max(expected, 0.01), 0.99);
}

// ─────────────────────────────────────────────────────────────
// BAHİS KATLAMA KARARLARI
//
// Klasik tavla ölçütleri: kazanma ihtimali yaklaşık %70'i geçtiğinde
// katlamak kârlıdır; karşı taraf ise %25'in üstünde şansı varsa kabul
// etmelidir (reddederse mevcut bahsi kesin kaybeder, kabul ederse iki
// katına oynar ama oyunda kalır).
//
// Sabit eşik makine gibi durur; bu yüzden kararlara zorluğa bağlı bir
// oynaklık ve küçük bir cesaret payı eklenir. Böylece rakip bazen sınırda
// katlar, bazen zayıf konumda blöfe yakın bir kabul yapar.
// ─────────────────────────────────────────────────────────────
// Katlama kararında rakip cevaplarının örneklem sınırı. Karar tur başına
// en çok bir kez verildiği için hamle aramasından daha geniş tutulabilir.
const CUBE_REPLY_CAP = 40;

const CUBE_STYLE = {
  easy:   { offerAt: 0.86, takeDown: 0.34, jitter: 0.10, boldness: 0.00 },
  medium: { offerAt: 0.76, takeDown: 0.28, jitter: 0.06, boldness: 0.02 },
  hard:   { offerAt: 0.70, takeDown: 0.24, jitter: 0.04, boldness: 0.04 },
};

function styleFor(difficulty) {
  return CUBE_STYLE[difficulty] || CUBE_STYLE.medium;
}

/**
 * Katlama önerilsin mi? Çok önde olunan konumda katlamak da kötüdür:
 * rakip pas geçer, kazanç tek katta kalır. Bu yüzden üst sınır konur.
 */
export function shouldOfferRaise(board, bar, borneOff, player, difficulty) {
  const st = styleFor(difficulty);
  // Teklifi veren taraf zarı henüz atmadı: sıra kendisindedir
  const p = lookaheadWinProbability(board, bar, borneOff, player, player);
  const noise = (Math.random() * 2 - 1) * st.jitter;
  const effective = p + noise + st.boldness;

  // Kazanç neredeyse kesinken katlamak rakibi kaçırır: pas geçer, tek kat kalır
  if (p > 0.93) return false;
  return effective >= st.offerAt;
}

/**
 * Gelen katlama kabul edilsin mi? Reddetmek mevcut bahsi kesin kaybettirir,
 * kabul etmek oyunda kalmayı sağlar; bu yüzden eşik %50 değil, %25 civarıdır.
 */
export function shouldAcceptRaise(board, bar, borneOff, player, difficulty) {
  const st = styleFor(difficulty);
  // Teklifi veren taraf sırada: kabul edersek önce o atacak
  const opponent = player === WHITE ? BLACK : WHITE;
  const p = lookaheadWinProbability(board, bar, borneOff, player, opponent);
  const noise = (Math.random() * 2 - 1) * st.jitter;
  const effective = p + noise + st.boldness;
  return effective >= st.takeDown;
}

export { WIN_PROB_COEF };

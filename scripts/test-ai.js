/**
 * Uzman seviye yapay zekanın referans testi.
 *
 * Her pozisyonun doğru cevabı tavla teorisinde tartışmasızdır; bu yüzden
 * hatalı bir hamle, değerlendirme fonksiyonunda gerçek bir modelleme
 * hatasına işaret eder. Bu testler daha önce üç gerçek hatayı yakaladı
 * (anchor değerinin noktaya göre değişmemesi, gömülen taşın cezasız
 * kalması, ucuz blotların pahalı sanılması).
 *
 * Kullanım: node scripts/test-ai.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const babel = require('@babel/core');

// Kaynak ES modülleri, Node'da çalışacak biçime çevrilir
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tavla-ai-'));
const SRC = path.join(__dirname, '..', 'src', 'utils');
for (const name of ['diceUtils', 'gameLogic', 'aiPlayer']) {
  const code = babel.transformFileSync(path.join(SRC, `${name}.js`), {
    configFile: false,
    babelrc: false,
    plugins: [['@babel/plugin-transform-modules-commonjs', { importInterop: 'none' }]],
  }).code;
  fs.writeFileSync(path.join(tmp, `${name}.js`), code);
}

const GL = require(path.join(tmp, 'gameLogic.js'));
const { WHITE, BLACK } = require(path.join(tmp, 'diceUtils.js'));
const { getAIMoves } = require(path.join(tmp, 'aiPlayer.js'));

const DIFF = 'hard';
const bar0 = { white: 0, black: 0 };
const off0 = { white: 0, black: 0 };

function apply(board, bar, off, moves, player) {
  let st = { board: [...board], bar: { ...bar }, borneOff: { ...off } };
  for (const m of moves) {
    const ns = GL.applyMove(st.board, st.bar, st.borneOff, m, player);
    st = { board: ns.board, bar: ns.bar, borneOff: ns.borneOff };
  }
  return st;
}

// Hamleleri tavla gösterimine çevirir (oyuncunun kendi numaralamasıyla)
function describe(moves, player) {
  return moves.map(m => {
    const f = m.from === 'bar' ? 'bar' : (player === WHITE ? m.from + 1 : 24 - m.from);
    const t = m.to === 'off' ? 'off' : (player === WHITE ? m.to + 1 : 24 - m.to);
    return `${f}/${t}`;
  }).join(' ') || '(hamle yok)';
}

let pass = 0, fail = 0;
function test(name, board, bar, off, player, dice, check, expected) {
  const moves = getAIMoves(board, bar, off, player, dice, DIFF);
  const st = apply(board, bar, off, moves, player);
  if (check(st)) {
    pass++;
    console.log(`  gecti   ${name}  -> ${describe(moves, player)}`);
  } else {
    fail++;
    console.log(`  KALDI   ${name}  -> ${describe(moves, player)}   (beklenen: ${expected})`);
  }
}

const init = GL.createInitialBoard();

// ─── Açılış hamleleri ─────────────────────────────
// Modern tavla teorisinde üzerinde uzlaşılan en iyi açılışlar.
console.log('Acilis hamleleri');
test('3-1 besinci noktayi yapar', init, bar0, off0, WHITE, [3, 1], s => s.board[4] === 2, '8/5 6/5');
test('4-2 dorduncu noktayi yapar', init, bar0, off0, WHITE, [4, 2], s => s.board[3] === 2, '8/4 6/4');
test('6-1 bar noktasini yapar', init, bar0, off0, WHITE, [6, 1], s => s.board[6] === 2, '13/7 8/7');
test('5-3 ucuncu noktayi yapar', init, bar0, off0, WHITE, [5, 3], s => s.board[2] === 2, '8/3 6/3');
test('6-5 geri tasi kacirir', init, bar0, off0, WHITE, [6, 5],
  s => s.board[23] === 1 && s.board[12] === 6, '24/13');

// ─── Taktik ───────────────────────────────────────
console.log('\nTaktik');
{
  const b = new Array(24).fill(0);
  b[3] = -1; b[7] = 3; b[12] = 5; b[5] = 4; b[23] = 2;
  b[0] = -1; b[11] = -5; b[16] = -3; b[18] = -5;
  test('kendi evindeki blotu vurur (4-2)', b, bar0, off0, WHITE, [4, 2],
    s => (s.bar.black || 0) >= 1, '4-noktasindaki blotu vurma');
}
{
  const b = new Array(24).fill(0);
  b[20] = -1; b[5] = 5; b[7] = 3; b[12] = 4;
  b[0] = -2; b[11] = -5; b[16] = -3; b[18] = -4;
  test('bardan girerken vurur (4-3)', b, { white: 1, black: 0 }, off0, WHITE, [4, 3],
    s => (s.bar.black || 0) >= 1 && (s.bar.white || 0) === 0, 'bar/20* ile giris');
}
{
  const b = new Array(24).fill(0);
  b[5] = 2; b[4] = 2; b[3] = 3; b[2] = 3; b[7] = 3; b[12] = 2;
  b[1] = -1; b[18] = -5; b[19] = -5; b[20] = -4;
  test('vurup kapatir, risk birakmaz (2-1)', b, bar0, off0, WHITE, [2, 1], s => {
    let blots = 0;
    for (let i = 0; i < 24; i++) if (s.board[i] === 1) blots++;
    return (s.bar.black || 0) >= 1 && s.board[1] === 2 && blots === 0;
  }, '4/2* 3/2 — vur, noktayi yap, blot birakma');
}
{
  const b = new Array(24).fill(0);
  b[5] = 5; b[7] = 5; b[23] = 5;
  b[3] = -1; b[18] = -7; b[19] = -7;
  test('yarista geride kalinca vurur (4-2)', b, bar0, off0, WHITE, [4, 2],
    s => (s.bar.black || 0) >= 1, 'vurmak tek sanstir');
}

// ─── Konum yargısı ────────────────────────────────
console.log('\nKonum yargisi');
{
  const b = new Array(24).fill(0);
  b[13] = 3; b[8] = 3; b[7] = 2; b[5] = 3; b[4] = 2; b[3] = 2;
  b[2] = -2; b[18] = -5; b[19] = -4; b[20] = -4;
  test('gereksiz blot birakmaz (6-3)', b, bar0, off0, WHITE, [6, 3], s => {
    for (let i = 3; i < 24; i++) if (s.board[i] === 1) return false;
    return true;
  }, 'guvenli oyun, blot yok');
}
{
  const b = new Array(24).fill(0);
  b[19] = 2; b[12] = 5; b[7] = 4; b[5] = 4;
  b[0] = -2; b[11] = -5; b[16] = -3; b[18] = -5;
  test('altin anchoru bosuna birakmaz (4-3)', b, bar0, off0, WHITE, [4, 3],
    s => s.board[19] >= 2, 'baska yerde oynar, anchor durur');
}
{
  const b = new Array(24).fill(0);
  b[23] = 2; b[12] = 5; b[7] = 4; b[5] = 4;
  b[18] = -2; b[19] = -2; b[20] = -2; b[21] = -2; b[0] = -2; b[11] = -5;
  test('guclu rakip evinden kacar (6-5)', b, bar0, off0, WHITE, [6, 5],
    s => s.board[23] < 2, '24/18 18/13 ile guvenli kacis');
}
{
  const b = new Array(24).fill(0);
  b[7] = 3; b[12] = 5; b[5] = 5; b[23] = 2;
  b[0] = -2; b[11] = -5; b[16] = -3; b[18] = -5;
  test('taslari 1-2 noktalarina gommez (6-2)', b, bar0, off0, WHITE, [6, 2],
    s => s.board[0] <= 0 && s.board[1] <= 0, 'derin noktalara gomme yok');
}

// ─── Toplama ve yarış ─────────────────────────────
console.log('\nToplama ve yaris');
{
  const b = new Array(24).fill(0);
  b[0] = 2; b[1] = 3; b[2] = 3; b[3] = 3; b[4] = 2; b[5] = 2;
  b[23] = -2; b[22] = -2; b[18] = -5; b[19] = -4;
  test('kurallara uygun toplar (6-5)', b, bar0, off0, WHITE, [6, 5], s => {
    const total = s.borneOff.white + s.board.reduce((a, v) => a + (v > 0 ? v : 0), 0);
    return total === 15;
  }, 'iki zari da kullanan gecerli toplama');
}
{
  const b = new Array(24).fill(0);
  b[1] = 2; b[2] = 2; b[3] = 2; b[4] = 2; b[5] = 2;
  b[0] = -2; b[18] = -7; b[19] = -6;
  test('toplarken atis birakmaz (2-1)', b, bar0, { white: 5, black: 0 }, WHITE, [2, 1], s => {
    for (let i = 1; i <= 6; i++) if (s.board[i] === 1) return false;
    return true;
  }, 'rakip anchoru vuramamali');
}
{
  const b = new Array(24).fill(0);
  b[6] = 2; b[5] = 4; b[4] = 4; b[2] = 2; b[1] = 3;
  b[18] = -8; b[19] = -7;
  test('eve doldururken boslugu kapatir (3-1)', b, bar0, off0, WHITE, [3, 1],
    s => s.board[3] >= 1, '7/4 ile bos noktayi doldurma');
}
{
  const b = new Array(24).fill(0);
  b[4] = 2; b[5] = 2; b[6] = 2; b[7] = 2; b[8] = 2; b[9] = 2; b[10] = 3;
  b[18] = -3; b[19] = -3; b[20] = -3; b[21] = -3; b[22] = -3;
  test('yarista zarin tamamini oynar (5-3)', b, bar0, off0, WHITE, [5, 3], s => {
    let pips = 0;
    for (let i = 0; i < 24; i++) if (s.board[i] > 0) pips += s.board[i] * (i + 1);
    return pips === 123 - 8;
  }, '8 pip ilerleme');
}

fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\nSonuc: ${pass} gecti / ${fail} kaldi`);
process.exit(fail ? 1 : 0);

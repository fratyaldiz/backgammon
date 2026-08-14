/**
 * Oyun seslerini üretir (16-bit PCM mono WAV, 44.1 kHz).
 * Harici ses dosyası veya kütüphane gerektirmez; tavla sesleri perküsif
 * olduğu için sentez temiz sonuç verir ve lisans sorunu doğurmaz.
 *
 * Kullanım: node scripts/generate-sounds.js
 */
const fs = require('fs');
const path = require('path');

const SR = 44100;
const OUT = path.join(__dirname, '..', 'assets', 'sounds');

// ─── Temel yardımcılar ───────────────────────────
const buf = (seconds) => new Float64Array(Math.ceil(SR * seconds));

// Üstel sönüm zarfı
const decay = (t, tau) => Math.exp(-t / tau);

// Saldırı + sönüm (tık seslerinde tıklama artefaktını önler)
function env(t, attack, tau) {
  if (t < attack) return t / attack;
  return decay(t - attack, tau);
}

// Tek kutuplu alçak geçiren süzgeç
function lowpass(data, cutoff) {
  const dt = 1 / SR;
  const rc = 1 / (2 * Math.PI * cutoff);
  const a = dt / (rc + dt);
  let prev = 0;
  for (let i = 0; i < data.length; i++) {
    prev = prev + a * (data[i] - prev);
    data[i] = prev;
  }
  return data;
}

// Tek kutuplu yüksek geçiren süzgeç
function highpass(data, cutoff) {
  const dt = 1 / SR;
  const rc = 1 / (2 * Math.PI * cutoff);
  const a = rc / (rc + dt);
  let prevIn = 0, prevOut = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    prevOut = a * (prevOut + x - prevIn);
    prevIn = x;
    data[i] = prevOut;
  }
  return data;
}

// Rezonans: basit iki kutuplu bant geçiren (çınlama verir)
function resonate(data, freq, q) {
  const w = (2 * Math.PI * freq) / SR;
  const r = Math.exp(-w / (2 * q));
  const a1 = 2 * r * Math.cos(w);
  const a2 = -r * r;
  let y1 = 0, y2 = 0;
  for (let i = 0; i < data.length; i++) {
    const y = data[i] + a1 * y1 + a2 * y2;
    y2 = y1; y1 = y;
    data[i] = y * (1 - r);
  }
  return data;
}

// Yumuşak kırpma: sert tepe noktalarını yuvarlar
const softClip = (x) => Math.tanh(x * 1.25);

function addNoise(out, start, dur, amp, tau, attack = 0.0008) {
  const s = Math.floor(start * SR);
  const n = Math.floor(dur * SR);
  for (let i = 0; i < n && s + i < out.length; i++) {
    const t = i / SR;
    out[s + i] += (Math.random() * 2 - 1) * amp * env(t, attack, tau);
  }
}

function addTone(out, start, dur, freq, amp, tau, { harmonics = [1], glide = 0, attack = 0.002 } = {}) {
  const s = Math.floor(start * SR);
  const n = Math.floor(dur * SR);
  let phase = 0;
  for (let i = 0; i < n && s + i < out.length; i++) {
    const t = i / SR;
    const f = freq * (1 + glide * t);
    phase += (2 * Math.PI * f) / SR;
    let v = 0;
    for (let h = 0; h < harmonics.length; h++) {
      v += harmonics[h] * Math.sin(phase * (h + 1));
    }
    out[s + i] += v * amp * env(t, attack, tau);
  }
}

// Kısa yankı: birkaç geciken kopya, mekân hissi verir
function reverb(data, taps) {
  const out = new Float64Array(data.length);
  out.set(data);
  for (const [delayMs, gain] of taps) {
    const d = Math.floor((delayMs / 1000) * SR);
    for (let i = d; i < data.length; i++) out[i] += data[i - d] * gain;
  }
  return out;
}

function normalize(data, peak = 0.85) {
  let max = 0;
  for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i]));
  if (max === 0) return data;
  const g = peak / max;
  for (let i = 0; i < data.length; i++) data[i] = softClip(data[i] * g);
  return data;
}

// Baş/son yumuşatma: hoparlörde tık sesini engeller
function fadeEdges(data, ms = 4) {
  const n = Math.floor((ms / 1000) * SR);
  for (let i = 0; i < n && i < data.length; i++) {
    data[i] *= i / n;
    data[data.length - 1 - i] *= i / n;
  }
  return data;
}

function writeWav(data, name) {
  const n = data.length;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVE', 8);
  b.write('fmt ', 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);        // PCM
  b.writeUInt16LE(1, 22);        // mono
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, data[i]));
    b.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  const file = path.join(OUT, name);
  fs.writeFileSync(file, b);
  console.log(`  ${name.padEnd(14)} ${(n / SR).toFixed(2)}s  ${(b.length / 1024).toFixed(1)} KB`);
}

// ─── Sesler ──────────────────────────────────────

// Zar: birkaç düzensiz çarpma, sonda masaya oturma
function dice() {
  const out = buf(0.85);
  const impacts = [0.00, 0.075, 0.135, 0.215, 0.27, 0.36, 0.47, 0.60];
  for (let i = 0; i < impacts.length; i++) {
    const strength = 0.5 + 0.5 * Math.random();
    const late = i / impacts.length;
    addNoise(out, impacts[i], 0.09, 0.55 * strength * (1 - late * 0.35), 0.011);
    // sert plastik çınlaması
    addTone(out, impacts[i], 0.07, 1400 + Math.random() * 900, 0.16 * strength, 0.010, { harmonics: [1, 0.35] });
    // ahşap masa gövdesi
    addTone(out, impacts[i], 0.10, 190 + Math.random() * 70, 0.22 * strength, 0.022);
  }
  let d = highpass(out, 160);
  d = resonate(d, 720, 1.6);
  d = lowpass(d, 9500);
  return fadeEdges(normalize(d, 0.8));
}

// Taş koyma: kısa ahşap tık
function move() {
  const out = buf(0.18);
  addNoise(out, 0, 0.05, 0.6, 0.006);
  addTone(out, 0, 0.12, 950, 0.35, 0.020, { harmonics: [1, 0.3, 0.12] });
  addTone(out, 0, 0.10, 340, 0.30, 0.028);
  let d = highpass(out, 220);
  d = resonate(d, 900, 2.2);
  d = lowpass(d, 8000);
  return fadeEdges(normalize(d, 0.78));
}

// Kırma: daha ağır, alçak tok ses
function hit() {
  const out = buf(0.42);
  addNoise(out, 0, 0.10, 0.75, 0.016);
  addTone(out, 0, 0.30, 165, 0.55, 0.075, { harmonics: [1, 0.4, 0.15], glide: -0.25 });
  addTone(out, 0, 0.16, 480, 0.28, 0.030);
  addTone(out, 0.015, 0.20, 96, 0.35, 0.055);
  let d = resonate(out, 210, 2.4);
  d = lowpass(d, 5200);
  return fadeEdges(normalize(d, 0.9));
}

// Taş toplama: tık + parlak kısa çınlama
function bearOff() {
  const out = buf(0.45);
  addNoise(out, 0, 0.035, 0.4, 0.005);
  addTone(out, 0, 0.40, 1320, 0.42, 0.110, { harmonics: [1, 0.25] });
  addTone(out, 0.01, 0.35, 1980, 0.22, 0.080);
  let d = highpass(out, 400);
  d = lowpass(d, 11000);
  d = reverb(d, [[28, 0.18], [55, 0.09]]);
  return fadeEdges(normalize(d, 0.72));
}

// Para: iki parlak metalik çınlama
function coin() {
  const out = buf(0.55);
  const notes = [[0.0, 1750], [0.075, 2400]];
  for (const [t0, f] of notes) {
    addTone(out, t0, 0.42, f, 0.5, 0.115, { harmonics: [1, 0.42, 0.18] });
    addTone(out, t0, 0.30, f * 2.02, 0.16, 0.070);
    addNoise(out, t0, 0.012, 0.18, 0.003);
  }
  let d = highpass(out, 700);
  d = lowpass(d, 13000);
  d = reverb(d, [[35, 0.22], [70, 0.12], [120, 0.06]]);
  return fadeEdges(normalize(d, 0.7));
}

// Kazanma: yükselen majör arpej
function win() {
  const out = buf(1.35);
  const seq = [[0.00, 523.25], [0.10, 659.25], [0.20, 783.99], [0.32, 1046.50]];
  for (const [t0, f] of seq) {
    addTone(out, t0, 1.0, f, 0.34, 0.30, { harmonics: [1, 0.32, 0.12, 0.05], attack: 0.008 });
    addTone(out, t0, 0.7, f * 2, 0.10, 0.20, { attack: 0.008 });
  }
  let d = lowpass(out, 9000);
  d = reverb(d, [[60, 0.28], [125, 0.16], [210, 0.08]]);
  return fadeEdges(normalize(d, 0.68), 8);
}

// Kaybetme: alçalan iki ton
function lose() {
  const out = buf(1.05);
  addTone(out, 0.00, 0.55, 392.00, 0.38, 0.22, { harmonics: [1, 0.3, 0.1], attack: 0.01 });
  addTone(out, 0.26, 0.70, 311.13, 0.40, 0.30, { harmonics: [1, 0.3, 0.1], attack: 0.01 });
  addTone(out, 0.26, 0.70, 233.08, 0.26, 0.30, { attack: 0.01 });
  let d = lowpass(out, 4200);
  d = reverb(d, [[70, 0.22], [140, 0.10]]);
  return fadeEdges(normalize(d, 0.66), 8);
}

// Buton dokunuşu
function tap() {
  const out = buf(0.09);
  addNoise(out, 0, 0.02, 0.35, 0.0035);
  addTone(out, 0, 0.06, 1650, 0.24, 0.012);
  let d = highpass(out, 500);
  d = lowpass(d, 9000);
  return fadeEdges(normalize(d, 0.5), 3);
}

// ─── Üretim ──────────────────────────────────────
fs.mkdirSync(OUT, { recursive: true });
console.log('Sesler uretiliyor...');
writeWav(dice(), 'dice.wav');
writeWav(move(), 'move.wav');
writeWav(hit(), 'hit.wav');
writeWav(bearOff(), 'bearoff.wav');
writeWav(coin(), 'coin.wav');
writeWav(win(), 'win.wav');
writeWav(lose(), 'lose.wav');
writeWav(tap(), 'tap.wav');
console.log('Tamam.');

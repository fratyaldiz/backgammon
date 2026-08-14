/**
 * Uygulama ikonlarını üretir. Harici görsel aracı gerektirmez.
 *
 * Çizim 4x çözünürlükte yapılıp küçültülür (supersampling); bu sayede
 * üçgen ve daire kenarları pürüzsüz çıkar.
 *
 * Kullanım: node scripts/generate-icons.js
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const SS = 4;                       // supersampling çarpanı
const OUT = path.join(__dirname, '..', 'assets');

// ─── Renk paleti (tema ile uyumlu) ───────────────
const C = {
  bgOuter: [26, 14, 8],
  bgInner: [74, 37, 17],
  frame: [212, 175, 55],
  triDark: [58, 30, 14],
  triLight: [243, 226, 200],
  checkerHi: [255, 255, 255],
  checkerLo: [190, 170, 140],
  checkerEdge: [120, 105, 85],
  darkCheckerHi: [80, 80, 96],
  darkCheckerLo: [20, 20, 34],
};

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Nokta üçgenin içinde mi? (barycentric)
function inTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (d === 0) return false;
  const a = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / d;
  const b = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / d;
  const c = 1 - a - b;
  return a >= 0 && b >= 0 && c >= 0;
}

function roundedRectAlpha(x, y, w, h, r) {
  // İçeride 1, dışarıda 0 (kenar yumuşatma supersampling ile geliyor)
  const cx = Math.min(Math.max(x, r), w - r);
  const cy = Math.min(Math.max(y, r), h - r);
  const dx = x - cx, dy = y - cy;
  if (x >= r && x <= w - r) return (y >= 0 && y <= h) ? 1 : 0;
  if (y >= r && y <= h - r) return (x >= 0 && x <= w - r + r) ? 1 : 0;
  return dx * dx + dy * dy <= r * r ? 1 : 0;
}

/**
 * Tek bir pikselin rengini hesaplar.
 * transparentBg: Android adaptive icon'un ön planı için arka plan çizilmez.
 */
function shade(x, y, size, opts) {
  const { transparentBg = false, contentScale = 1 } = opts;
  const S = size;
  const cx = S / 2, cy = S / 2;

  // İçerik ölçeği: adaptive icon'da güvenli alan için içerik küçültülür
  const sx = cx + (x - cx) / contentScale;
  const sy = cy + (y - cy) / contentScale;

  let rgb = null;
  let alpha = 0;

  // ── Arka plan: yuvarlatılmış kare, radyal gradyan ──
  if (!transparentBg) {
    const inside = roundedRectAlpha(x, y, S, S, S * 0.22);
    if (inside > 0) {
      const d = Math.hypot(x - cx, y - cy) / (S * 0.72);
      rgb = mix(C.bgInner, C.bgOuter, clamp01(d));
      alpha = 1;
    }
  }

  // Bundan sonrası içerik: ölçeklenmiş koordinatlarla çizilir
  if (sx < 0 || sy < 0 || sx > S || sy > S) return { rgb, alpha };

  // ── Tahta alanı (iç panel) ──
  const boardMargin = S * 0.17;
  const bx0 = boardMargin, bx1 = S - boardMargin;
  const by0 = S * 0.19, by1 = S - S * 0.19;

  const inBoard = sx >= bx0 && sx <= bx1 && sy >= by0 && sy <= by1;

  if (inBoard) {
    // Altın çerçeve
    const edge = S * 0.018;
    const nearEdge =
      sx < bx0 + edge || sx > bx1 - edge || sy < by0 + edge || sy > by1 - edge;
    if (nearEdge) {
      rgb = C.frame; alpha = 1;
    } else {
      rgb = [40, 22, 11]; alpha = 1;

      // ── Üçgenler: üstte aşağı bakan 3, altta yukarı bakan 3 ──
      const iw = (bx1 - bx0) - 2 * edge;
      const x0 = bx0 + edge;
      const cols = 4;
      const colW = iw / cols;
      const triH = (by1 - by0) * 0.40;

      for (let i = 0; i < cols; i++) {
        const lx = x0 + i * colW;
        const mxp = lx + colW / 2;
        const rx = lx + colW;
        const col = i % 2 === 0 ? C.triLight : C.triDark;

        // Üst sıra: tabanı yukarıda, ucu aşağıda
        if (inTriangle(sx, sy, lx, by0 + edge, rx, by0 + edge, mxp, by0 + edge + triH)) {
          rgb = col;
        }
        // Alt sıra: tabanı aşağıda, ucu yukarıda (renkler ters)
        const colB = i % 2 === 0 ? C.triDark : C.triLight;
        if (inTriangle(sx, sy, lx, by1 - edge, rx, by1 - edge, mxp, by1 - edge - triH)) {
          rgb = colB;
        }
      }
    }
  }

  // ── Ortadaki taş (marka öğesi) ──
  const chR = S * 0.155;
  const dCh = Math.hypot(sx - cx, sy - cy);
  if (dCh <= chR) {
    const t = clamp01((sy - (cy - chR)) / (2 * chR));
    let base = mix(C.checkerHi, C.checkerLo, t);
    // dış halka
    if (dCh > chR * 0.86) base = C.checkerEdge;
    // iç halka
    else if (dCh > chR * 0.55 && dCh < chR * 0.66) base = mix(base, C.checkerEdge, 0.45);
    // üst parlama
    const spec = clamp01(1 - Math.hypot(sx - (cx - chR * 0.3), sy - (cy - chR * 0.35)) / (chR * 0.8));
    base = mix(base, [255, 255, 255], spec * 0.45);
    rgb = base;
    alpha = 1;
  }

  return { rgb, alpha };
}

function render(size, opts) {
  const big = size * SS;
  const acc = new Float64Array(size * size * 4);

  for (let y = 0; y < big; y++) {
    for (let x = 0; x < big; x++) {
      const { rgb, alpha } = shade((x + 0.5) / SS, (y + 0.5) / SS, size, opts);
      const dx = Math.floor(x / SS), dy = Math.floor(y / SS);
      const o = (dy * size + dx) * 4;
      if (alpha > 0 && rgb) {
        acc[o] += rgb[0]; acc[o + 1] += rgb[1]; acc[o + 2] += rgb[2]; acc[o + 3] += 255;
      }
    }
  }

  const png = new PNG({ width: size, height: size });
  const n = SS * SS;
  for (let i = 0; i < size * size; i++) {
    const o = i * 4;
    const a = acc[o + 3] / n;
    // Ortalama renk yalnızca kaplanan örneklerden alınır (kenarlarda doğru renk)
    const cov = a / 255;
    const div = cov > 0 ? n * cov : 1;
    png.data[o] = Math.round(acc[o] / div);
    png.data[o + 1] = Math.round(acc[o + 1] / div);
    png.data[o + 2] = Math.round(acc[o + 2] / div);
    png.data[o + 3] = Math.round(a);
  }
  return png;
}

function write(png, name) {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, PNG.sync.write(png));
  const kb = (fs.statSync(file).size / 1024).toFixed(1);
  console.log(`  ${name.padEnd(24)} ${png.width}x${png.height}  ${kb} KB`);
}

// ─── Üretim ──────────────────────────────────────
fs.mkdirSync(OUT, { recursive: true });
console.log('Ikonlar uretiliyor...');

// Uygulama ikonu (iOS + genel)
write(render(1024, {}), 'icon.png');

// Android adaptive icon ön planı: içerik güvenli alanda kalmalı (~%66)
write(render(1024, { transparentBg: true, contentScale: 0.62 }), 'adaptive-icon.png');

// Splash: şeffaf zeminde ortalanmış logo
write(render(1024, { transparentBg: true, contentScale: 0.8 }), 'splash-icon.png');

// Web favicon
write(render(64, {}), 'favicon.png');

console.log('Tamam.');

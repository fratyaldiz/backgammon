import React, { useRef, useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, Text, PanResponder, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import useGameStore from '../store/gameStore';
import Checker from './Checker';
import THEME from '../constants/theme';
import { WHITE, BLACK } from '../utils/diceUtils';
import { clamp } from '../utils/layout';

// ─── Point (Üçgen) Bileşeni ─────────────────────
const Point = ({ index, isUp, checkers, owner, isSelected, isDestination, pointWidth, triangleHeight, checkerSize }) => {
  const color = index % 2 === 0 ? THEME.colors.triangleDark : THEME.colors.triangleLight;

  return (
    <View style={[styles.pointContainer, isUp ? styles.pointUp : styles.pointDown, { width: pointWidth }]}>
      <View style={[
        styles.triangle,
        isUp ? { bottom: 0, borderBottomWidth: triangleHeight } : { top: 0, borderTopWidth: triangleHeight },
        {
          borderLeftWidth: pointWidth / 2,
          borderRightWidth: pointWidth / 2,
          borderBottomColor: isUp ? color : 'transparent',
          borderTopColor: !isUp ? color : 'transparent',
        },
        isDestination && { opacity: 0.7 },
      ]}>
        {isDestination && (
          <View style={[
            styles.highlight,
            isUp
              ? { bottom: 0, borderBottomWidth: triangleHeight, borderBottomColor: THEME.colors.triangleHighlight }
              : { top: 0, borderTopWidth: triangleHeight, borderTopColor: THEME.colors.triangleHighlight },
            { borderLeftWidth: pointWidth / 2, borderRightWidth: pointWidth / 2, left: -pointWidth / 2 },
          ]} />
        )}
      </View>

      {/* Geçerli hedef halkası */}
      {isDestination && (
        <View style={[
          styles.destRing,
          {
            width: checkerSize * 0.62,
            height: checkerSize * 0.62,
            borderRadius: checkerSize * 0.31,
          },
          isUp ? { bottom: checkerSize * 0.35 } : { top: checkerSize * 0.35 },
        ]} />
      )}

      <View style={[styles.checkersContainer, isUp ? { bottom: 2 } : { top: 2 }]}>
        {Array.from({ length: Math.min(checkers, 5) }).map((_, i) => {
          const overlap = Math.floor(checkerSize * 0.22);
          return (
            <View key={i} style={{ marginTop: isUp ? -overlap : (i === 0 ? 0 : -overlap) }}>
              <Checker
                color={owner}
                isSelected={isSelected && i === checkers - 1}
                count={i === 4 && checkers > 5 ? checkers : null}
                size={checkerSize}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
};

/**
 * Tahta ölçüleri yalnızca ölçülen kapsayıcıdan türetilir.
 *
 * Önceki sürüm ekran genişliğinden ve kenar çubuğu/dolgu için sabit
 * varsayımlardan hesap yapıyordu; gerçek kapsayıcı farklı olduğu için
 * çizim ile dokunma testi birbirini tutmuyor, cihaza göre kayma
 * oluşuyordu. Ölçüm tabanlı hesap her cihazda birebir tutar.
 */
export function computeBoardMetrics(contentW, contentH) {
  const bearOffGap = 4;
  const bearOffW = clamp(contentW * 0.062, 26, 72);
  const mainW = contentW - bearOffW - bearOffGap;

  // Taş boyutu ile bar genişliği birbirine bağlı: bir ön hesapla çöz
  const estPointW = (mainW - 46) / 12;
  const estChecker = Math.min(estPointW * 0.86, contentH * 0.115);
  const barW = clamp(Math.max(estChecker + 12, mainW * 0.045), 32, 84);

  // Kesirli genişlik: 12 üçgen + bar tam olarak mainW'yi doldurur, artık kalmaz
  const pointW = (mainW - barW) / 12;
  const checkerSize = Math.max(Math.min(pointW * 0.86, contentH * 0.115), 12);
  const triangleH = contentH * 0.44;

  return { bearOffW, bearOffGap, mainW, barW, pointW, checkerSize, triangleH, contentW, contentH };
}

// ─── Tahta Bileşeni ─────────────────────────────
const Board = () => {
  // Kapsayıcının gerçek ölçüsü; ölçülene kadar tahta çizilmez
  const [box, setBox] = useState(null);
  const m = box ? computeBoardMetrics(box.width, box.height) : null;

  const POINT_WIDTH = m ? m.pointW : 0;
  const CHECKER_SIZE = m ? m.checkerSize : 0;
  const BAR_W = m ? m.barW : 0;
  const BEAR_OFF_W = m ? m.bearOffW : 0;
  const TRIANGLE_HEIGHT = m ? m.triangleH : 0;
  const BAR_CHECKER_SIZE = CHECKER_SIZE;   // kırık taş normal taşla aynı boyutta

  // Taşlar tam boyutta olduğu için çok sayıda kırık taş bar'a sığmayabilir;
  // 3'ten sonrası kademeli olarak üst üste biner.
  const barStackOffset = (count) => {
    if (count <= 3) return 4;
    const maxRun = TRIANGLE_HEIGHT * 0.85;
    const needed = count * CHECKER_SIZE;
    if (needed <= maxRun) return 4;
    return -Math.min(Math.floor(CHECKER_SIZE * 0.55), Math.ceil((needed - maxRun) / (count - 1)));
  };

  // Store
  const board = useGameStore(s => s.board);
  const bar = useGameStore(s => s.bar);
  const borneOff = useGameStore(s => s.borneOff);
  const selectedPoint = useGameStore(s => s.selectedPoint);
  const validDestinations = useGameStore(s => s.validDestinations);
  const currentPlayer = useGameStore(s => s.currentPlayer);
  const playerColor = useGameStore(s => s.playerColor);
  const gamePhase = useGameStore(s => s.gamePhase);
  const isPaused = useGameStore(s => s.isPaused);
  const remainingMoves = useGameStore(s => s.remainingMoves);
  const lastMove = useGameStore(s => s.lastMove);
  const moveSeq = useGameStore(s => s.moveSeq);
  const selectPoint = useGameStore(s => s.selectPoint);
  const moveToDestination = useGameStore(s => s.moveToDestination);

  // Sürükleme state (ref ile - PanResponder closure sorunu için)
  const dragFrom = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const pan = useRef(new Animated.ValueXY()).current;
  const [dragVisible, setDragVisible] = useState(false);
  const [dragColor, setDragColor] = useState(BLACK);
  const boardLayoutRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // Kayma animasyonu state
  const slidePos = useRef(new Animated.ValueXY()).current;
  const [slideVisible, setSlideVisible] = useState(false);
  const [slideColor, setSlideColor] = useState(BLACK);
  const currentPlayerRef = useRef(currentPlayer);
  currentPlayerRef.current = currentPlayer;
  const lastMoveRef = useRef(lastMove);
  lastMoveRef.current = lastMove;
  const boardRef = useRef(board);
  boardRef.current = board;

  // Kırılma flash state
  const barFlash = useRef(new Animated.Value(0)).current;
  const prevBarTotal = useRef(bar.white + bar.black);

  // PanResponder'ın güncel store değerlerine erişimi için ref
  const storeRef = useRef({});
  storeRef.current = { board, bar, currentPlayer, playerColor, gamePhase, remainingMoves, isPaused, POINT_WIDTH, CHECKER_SIZE };

  // ─── Koordinattan nokta indeksi bulma ─────────
  // LAYOUT (Siyah oyuncu perspektifi - ev sağ alt):
  //   Üst sol: [11,10,9,8,7,6]   | bar | Üst sağ: [5,4,3,2,1,0]
  //   Alt sol: [12,13,14,15,16,17]| bar | Alt sağ: [18,19,20,21,22,23]   ← SİYAH'ın evi
  //   Sağda: Bear-off alanı
  const getPointFromXY = (x, y) => {
    const bw = boardLayoutRef.current.width;
    const bh = boardLayoutRef.current.height;
    if (bw === 0 || bh === 0) return null;

    const halfWidth = POINT_WIDTH * 6;
    const isTop = y < bh / 2;

    // Bar alanı kontrolü
    if (x >= halfWidth && x < halfWidth + BAR_W) return 'bar';

    let pointCol = -1;
    let isLeft = false;
    let isRight = false;

    if (x >= 0 && x < halfWidth) {
      isLeft = true;
      pointCol = Math.min(Math.max(Math.floor(x / POINT_WIDTH), 0), 5);
    } else if (x >= halfWidth + BAR_W) {
      isRight = true;
      const localX = x - halfWidth - BAR_W;
      pointCol = Math.min(Math.max(Math.floor(localX / POINT_WIDTH), 0), 5);

      // Sağ kenarın ötesinde: bear-off
      if (localX >= halfWidth) return 'off';
    }

    if (!isLeft && !isRight) return null;

    // Yeni layout indeksleri
    if (isTop) {
      if (isLeft) return 11 - pointCol;    // [11,10,9,8,7,6]
      else return 5 - pointCol;            // [5,4,3,2,1,0]
    } else {
      if (isLeft) return 12 + pointCol;    // [12,13,14,15,16,17]
      else return 18 + pointCol;           // [18,19,20,21,22,23]
    }
  };

  // ─── Nokta + yığın indeksinden ekran koordinatı (kayma animasyonu) ─
  // stackIndex: taşın üçgendeki dizilim sırası (kenardan içeri). Gerçek
  // taş konumuna denk gelsin diye yığın kayması hesaba katılır.
  const getCheckerXY = (idx, stackIndex) => {
    const bw = boardLayoutRef.current.width;
    const bh = boardLayoutRef.current.height;
    if (!bw || !bh) return null;

    const halfWidth = POINT_WIDTH * 6;
    if (idx === 'bar') return { x: halfWidth + BAR_W / 2, y: bh / 2 };
    if (idx === 'off') return { x: bw - 6, y: bh / 2 };

    let x, isTop;
    if (idx >= 6 && idx <= 11) {            // üst sol
      x = (11 - idx + 0.5) * POINT_WIDTH; isTop = true;
    } else if (idx >= 0 && idx <= 5) {      // üst sağ
      x = halfWidth + BAR_W + (5 - idx + 0.5) * POINT_WIDTH; isTop = true;
    } else if (idx >= 12 && idx <= 17) {    // alt sol
      x = (idx - 12 + 0.5) * POINT_WIDTH; isTop = false;
    } else {                                 // alt sağ 18-23
      x = halfWidth + BAR_W + (idx - 18 + 0.5) * POINT_WIDTH; isTop = false;
    }

    const step = CHECKER_SIZE * 0.78;
    const edge = 2 + CHECKER_SIZE / 2;
    const s = Math.min(Math.max(stackIndex, 0), 4);
    const y = isTop ? (edge + s * step) : (bh - edge - s * step);
    return { x, y };
  };

  // ─── Kayma animasyonu (sadece ileri hamlede: oyuncu + AI) ──
  // moveSeq yalnızca uygulanan hamlede artar; undo/reset'te değişmez.
  useEffect(() => {
    if (moveSeq === 0) return;
    const move = lastMoveRef.current;
    if (!move) return;
    const b = boardRef.current;

    // Kaynaktan ayrılan taşın yığın indeksi = çıkıştan sonraki taş sayısı
    const fromStack = (move.from === 'bar' || move.from === 'off') ? 0 : Math.abs(b[move.from]);
    // Hedefe konan taş = ekleme sonrası en üstteki taş
    const toStack = (move.to === 'off' || move.to === 'bar') ? 0 : Math.max(Math.abs(b[move.to]) - 1, 0);

    const from = getCheckerXY(move.from, fromStack);
    const to = getCheckerXY(move.to, toStack);
    if (!from || !to) return;

    setSlideColor(currentPlayerRef.current);
    slidePos.setValue({ x: from.x - CHECKER_SIZE / 2, y: from.y - CHECKER_SIZE / 2 });
    setSlideVisible(true);
    Animated.timing(slidePos, {
      toValue: { x: to.x - CHECKER_SIZE / 2, y: to.y - CHECKER_SIZE / 2 },
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => { if (finished) setSlideVisible(false); });
  }, [moveSeq]);

  // ─── Kırılma flash (bar'a yeni taş düşünce) ────
  useEffect(() => {
    const total = bar.white + bar.black;
    if (total > prevBarTotal.current) {
      barFlash.setValue(1);
      Animated.timing(barFlash, { toValue: 0, duration: 650, useNativeDriver: true }).start();
    }
    prevBarTotal.current = total;
  }, [bar.white, bar.black]);

  // ─── PanResponder (Dokunma + Sürükleme) ───────
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => {
      const s = storeRef.current;
      return !s.isPaused && s.gamePhase === 'moving' && s.currentPlayer === s.playerColor;
    },
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5,

    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      const s = storeRef.current;
      const idx = getPointFromXY(locationX, locationY);

      // Bear-off dokunması (sadece dokunma, sürükleme yok)
      if (idx === 'off') {
        dragFrom.current = idx;
        dragStartPos.current = { x: locationX, y: locationY };
        isDragging.current = false;
        return;
      }

      // Bar dokunması / sürüklemesi (kırık taş)
      if (idx === 'bar') {
        const barCount = s.currentPlayer === WHITE ? s.bar.white : s.bar.black;
        if (barCount > 0) {
          dragFrom.current = 'bar';
          dragStartPos.current = { x: locationX, y: locationY };
          isDragging.current = false;
          pan.setValue({ x: locationX - s.CHECKER_SIZE / 2, y: locationY - s.CHECKER_SIZE / 2 });
          setDragColor(s.currentPlayer);
        } else {
          dragFrom.current = null;
        }
        return;
      }

      if (idx !== null && idx >= 0 && idx <= 23) {
        const val = s.board[idx];
        const ownerMatch = (s.currentPlayer === WHITE && val > 0) || (s.currentPlayer === BLACK && val < 0);

        if (ownerMatch) {
          dragFrom.current = idx;
          dragStartPos.current = { x: locationX, y: locationY };
          isDragging.current = false;
          pan.setValue({ x: locationX - s.CHECKER_SIZE / 2, y: locationY - s.CHECKER_SIZE / 2 });
          setDragColor(s.currentPlayer);
        } else {
          dragFrom.current = null;
        }
      } else {
        dragFrom.current = null;
      }
    },

    onPanResponderMove: (evt, gs) => {
      if (dragFrom.current === null || dragFrom.current === 'off') return;
      const s = storeRef.current;
      const dist = Math.sqrt(gs.dx * gs.dx + gs.dy * gs.dy);

      if (!isDragging.current && dist > 12) {
        isDragging.current = true;
        setDragVisible(true);
      }

      if (isDragging.current) {
        const newX = dragStartPos.current.x + gs.dx - s.CHECKER_SIZE / 2;
        const newY = dragStartPos.current.y + gs.dy - s.CHECKER_SIZE / 2;
        pan.setValue({ x: newX, y: newY });
      }
    },

    onPanResponderRelease: (evt, gs) => {
      const from = dragFrom.current;
      if (from === null) return;

      const dist = Math.sqrt(gs.dx * gs.dx + gs.dy * gs.dy);

      if (dist < 12) {
        // DOKUNMA → otomatik hamle
        selectPoint(from);
      } else if (isDragging.current && from !== 'off') {
        // SÜRÜKLEME → hedef bul (bar dahil)
        const dropX = dragStartPos.current.x + gs.dx;
        const dropY = dragStartPos.current.y + gs.dy;
        const dropIdx = getPointFromXY(dropX, dropY);

        if (dropIdx !== null) {
          moveToDestination(from, dropIdx);
        }
      }

      dragFrom.current = null;
      isDragging.current = false;
      setDragVisible(false);
    },

    onPanResponderTerminate: () => {
      dragFrom.current = null;
      isDragging.current = false;
      setDragVisible(false);
    },
  }), [POINT_WIDTH, CHECKER_SIZE, selectPoint, moveToDestination]);

  // ─── Çeyrek Render ────────────────────────────
  const renderQuadrant = (indices, isUp) => (
    <View style={styles.quadrant}>
      {indices.map(i => {
        const count = Math.abs(board[i]);
        const owner = Math.sign(board[i]);
        return (
          <Point
            key={i}
            index={i}
            isUp={isUp}
            checkers={count}
            owner={owner}
            isSelected={selectedPoint === i}
            isDestination={validDestinations.includes(i)}
            pointWidth={POINT_WIDTH}
            triangleHeight={TRIANGLE_HEIGHT}
            checkerSize={CHECKER_SIZE}
          />
        );
      })}
    </View>
  );

  return (
    <LinearGradient
      colors={THEME.gradients.boardFrame}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.boardContainer}
    >
      {/* Ölçüm alanı: tüm boyutlar buradan türetilir */}
      <View
        style={styles.content}
        onLayout={e => {
          const { width: w, height: h } = e.nativeEvent.layout;
          if (!box || Math.abs(box.width - w) > 0.5 || Math.abs(box.height - h) > 0.5) {
            setBox({ width: w, height: h });
          }
        }}
      >
      {!m ? null : (
      <>
      {/* Ana Tahta */}
      <View
        style={[styles.mainBoard, { width: m.mainW }]}
        onLayout={e => { boardLayoutRef.current = e.nativeEvent.layout; }}
      >
        {/* Ahşap yüzey gradyanı */}
        <LinearGradient
          colors={THEME.gradients.boardSurface}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* Sol Yarı */}
        <View style={styles.halfBoard}>
          {renderQuadrant([11, 10, 9, 8, 7, 6], false)}
          {renderQuadrant([12, 13, 14, 15, 16, 17], true)}
        </View>

        {/* Bar (kırık taşlar) */}
        <View style={[styles.bar, { width: BAR_W }]}>
          <LinearGradient
            colors={THEME.gradients.barSurface}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Animated.View pointerEvents="none" style={[styles.barFlash, { opacity: barFlash }]} />
          <View style={styles.barCheckers}>
            {Array.from({ length: bar.white }).map((_, i) => (
              <View key={`w${i}`} style={{ marginTop: i === 0 ? 0 : barStackOffset(bar.white) }}>
                <Checker color={WHITE} size={BAR_CHECKER_SIZE} />
              </View>
            ))}
          </View>
          <View style={styles.barCheckers}>
            {Array.from({ length: bar.black }).map((_, i) => (
              <View key={`b${i}`} style={{ marginTop: i === 0 ? 0 : barStackOffset(bar.black) }}>
                <Checker color={BLACK} size={BAR_CHECKER_SIZE} />
              </View>
            ))}
          </View>
        </View>

        {/* Sağ Yarı */}
        <View style={styles.halfBoard}>
          {renderQuadrant([5, 4, 3, 2, 1, 0], false)}
          {renderQuadrant([18, 19, 20, 21, 22, 23], true)}
        </View>

        {/* Dokunma + Sürükleme overlay */}
        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} pointerEvents="box-only" />

        {/* Kayan taş (hamle animasyonu) */}
        {slideVisible && (
          <Animated.View style={[styles.slideChecker, { transform: slidePos.getTranslateTransform() }]} pointerEvents="none">
            <Checker color={slideColor} size={CHECKER_SIZE} />
          </Animated.View>
        )}

        {/* Sürüklenen taş */}
        {dragVisible && (
          <Animated.View style={[styles.floatingChecker, { transform: pan.getTranslateTransform() }]} pointerEvents="none">
            <Checker color={dragColor} size={CHECKER_SIZE} />
          </Animated.View>
        )}
      </View>

      {/* Taş Toplama Alanı (SAĞ TARAF) */}
      <LinearGradient
        colors={THEME.gradients.barSurface}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.bearOffArea, { width: BEAR_OFF_W, marginLeft: m.bearOffGap }]}
      >
        <View style={styles.bearOffBox}>
          <Text style={[styles.bearOffLabel, { fontSize: clamp(BEAR_OFF_W * 0.24, 8, 13) }]}>Beyaz</Text>
          <Text style={[styles.bearOffText, { fontSize: clamp(BEAR_OFF_W * 0.4, 12, 22) }]}>{borneOff.white}</Text>
          {borneOff.white > 0 && <Checker color={WHITE} size={Math.min(CHECKER_SIZE, BEAR_OFF_W - 8)} />}
        </View>
        <View style={styles.bearOffDivider} />
        <View style={styles.bearOffBox}>
          <Text style={[styles.bearOffLabel, { fontSize: clamp(BEAR_OFF_W * 0.24, 8, 13) }]}>Siyah</Text>
          <Text style={[styles.bearOffText, { fontSize: clamp(BEAR_OFF_W * 0.4, 12, 22) }]}>{borneOff.black}</Text>
          {borneOff.black > 0 && <Checker color={BLACK} size={Math.min(CHECKER_SIZE, BEAR_OFF_W - 8)} />}
        </View>
      </LinearGradient>
      </>
      )}
      </View>
    </LinearGradient>
  );
};

// ─── Stiller ────────────────────────────────────
const styles = StyleSheet.create({
  boardContainer: {
    flexDirection: 'row',
    padding: THEME.sizes.borderWidth,
    borderRadius: 10,
    borderWidth: 4,
    borderColor: THEME.colors.gold,
    width: '100%',
    height: '100%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 12,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  mainBoard: {
    height: '100%',
    flexDirection: 'row',
    backgroundColor: THEME.colors.boardLight,
    position: 'relative',
  },
  halfBoard: {
    flex: 1,
    justifyContent: 'space-between',
  },
  quadrant: {
    flexDirection: 'row',
    // Üçgen genişlikleri alanı tam doldurur; artık boşluk dağıtılmaz,
    // böylece çizim ile dokunma testi birebir örtüşür.
    justifyContent: 'flex-start',
    height: '47%',
  },
  bar: {
    // genişlik dinamik: taş boyutuna göre Board içinde veriliyor
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: THEME.colors.boardFrameInner,
    justifyContent: 'space-between',
    paddingVertical: 12,
    alignItems: 'center',
    overflow: 'hidden',
  },
  barFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: THEME.colors.danger,
  },
  barCheckers: {
    alignItems: 'center',
  },
  bearOffArea: {
    height: '100%',
    justifyContent: 'space-around',
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: THEME.colors.gold,
  },
  bearOffBox: {
    alignItems: 'center',
    gap: 2,
  },
  bearOffDivider: {
    width: '70%',
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.3)',
  },
  bearOffLabel: {
    color: THEME.colors.gold,
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  bearOffText: {
    color: THEME.colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  pointContainer: {
    alignItems: 'center',
    height: '100%',
  },
  pointUp: {
    justifyContent: 'flex-end',
  },
  pointDown: {
    justifyContent: 'flex-start',
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    position: 'absolute',
  },
  checkersContainer: {
    position: 'absolute',
    alignItems: 'center',
    width: '100%',
  },
  highlight: {
    position: 'absolute',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  destRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: THEME.colors.gold,
    backgroundColor: 'rgba(255,215,0,0.22)',
    zIndex: 2,
    shadowColor: THEME.colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 4,
  },
  floatingChecker: {
    position: 'absolute',
    zIndex: 200,
    opacity: 0.9,
  },
  slideChecker: {
    position: 'absolute',
    zIndex: 190,
  },
});

export default Board;

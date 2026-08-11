import React, { useRef, useState, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, useWindowDimensions, PanResponder, Animated } from 'react-native';
import useGameStore from '../store/gameStore';
import Checker from './Checker';
import THEME from '../constants/theme';
import { WHITE, BLACK } from '../utils/diceUtils';

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

// ─── Tahta Bileşeni ─────────────────────────────
const Board = () => {
  const { width, height } = useWindowDimensions();

  // Dinamik boyutlandırma
  const SIDEBAR_WIDTH = 200;
  const PADDING = 24;
  const BEAR_OFF_W = THEME.sizes.bearOffWidth;
  const BAR_W = THEME.sizes.barWidth;
  const BOARD_AVAILABLE = width - SIDEBAR_WIDTH - PADDING - BEAR_OFF_W - BAR_W;
  const POINT_WIDTH = Math.max(Math.floor((BOARD_AVAILABLE / 2) / 6), 20);
  const TRIANGLE_HEIGHT = height * 0.42;
  const CHECKER_SIZE = Math.max(Math.floor(POINT_WIDTH * 0.9), 18);

  // Store
  const board = useGameStore(s => s.board);
  const bar = useGameStore(s => s.bar);
  const borneOff = useGameStore(s => s.borneOff);
  const selectedPoint = useGameStore(s => s.selectedPoint);
  const validDestinations = useGameStore(s => s.validDestinations);
  const currentPlayer = useGameStore(s => s.currentPlayer);
  const playerColor = useGameStore(s => s.playerColor);
  const gamePhase = useGameStore(s => s.gamePhase);
  const remainingMoves = useGameStore(s => s.remainingMoves);
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

  // PanResponder'ın güncel store değerlerine erişimi için ref
  const storeRef = useRef({});
  storeRef.current = { board, bar, currentPlayer, playerColor, gamePhase, remainingMoves, POINT_WIDTH, CHECKER_SIZE };

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

  // ─── PanResponder (Dokunma + Sürükleme) ───────
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => {
      const s = storeRef.current;
      return s.gamePhase === 'moving' && s.currentPlayer === s.playerColor;
    },
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 5 || Math.abs(gs.dy) > 5,

    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      const s = storeRef.current;
      const idx = getPointFromXY(locationX, locationY);

      // Nokta veya bar dokunması
      if (idx === 'bar' || idx === 'off') {
        dragFrom.current = idx;
        dragStartPos.current = { x: locationX, y: locationY };
        isDragging.current = false;
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
      if (dragFrom.current === null || dragFrom.current === 'bar' || dragFrom.current === 'off') return;
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
      } else if (isDragging.current && from !== 'bar' && from !== 'off') {
        // SÜRÜKLEME → hedef bul
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
    <View style={styles.boardContainer}>
      {/* Ana Tahta */}
      <View
        style={styles.mainBoard}
        onLayout={e => { boardLayoutRef.current = e.nativeEvent.layout; }}
      >
        {/* Sol Yarı */}
        <View style={styles.halfBoard}>
          {renderQuadrant([11, 10, 9, 8, 7, 6], false)}
          {renderQuadrant([12, 13, 14, 15, 16, 17], true)}
        </View>

        {/* Bar */}
        <View style={styles.bar}>
          <View style={styles.barCheckers}>
            {Array.from({ length: bar.white }).map((_, i) => (
              <Checker key={`w${i}`} color={WHITE} size={Math.min(CHECKER_SIZE, 22)} />
            ))}
          </View>
          <View style={styles.barCheckers}>
            {Array.from({ length: bar.black }).map((_, i) => (
              <Checker key={`b${i}`} color={BLACK} size={Math.min(CHECKER_SIZE, 22)} />
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

        {/* Sürüklenen taş */}
        {dragVisible && (
          <Animated.View style={[styles.floatingChecker, { transform: pan.getTranslateTransform() }]}>
            <Checker color={dragColor} size={CHECKER_SIZE} />
          </Animated.View>
        )}
      </View>

      {/* Taş Toplama Alanı (SAĞ TARAF) */}
      <View style={styles.bearOffArea}>
        <View style={styles.bearOffBox}>
          <Text style={styles.bearOffLabel}>B</Text>
          <Text style={styles.bearOffText}>{borneOff.white}</Text>
          {borneOff.white > 0 && <Checker color={WHITE} size={Math.min(CHECKER_SIZE, 20)} />}
        </View>
        <View style={styles.bearOffBox}>
          <Text style={styles.bearOffLabel}>S</Text>
          <Text style={styles.bearOffText}>{borneOff.black}</Text>
          {borneOff.black > 0 && <Checker color={BLACK} size={Math.min(CHECKER_SIZE, 20)} />}
        </View>
      </View>
    </View>
  );
};

// ─── Stiller ────────────────────────────────────
const styles = StyleSheet.create({
  boardContainer: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.boardFrame,
    padding: THEME.sizes.borderWidth,
    borderRadius: 8,
    borderWidth: 4,
    borderColor: THEME.colors.boardFrameInner,
    width: '100%',
    height: '100%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  mainBoard: {
    flex: 1,
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
    justifyContent: 'space-evenly',
    height: '47%',
  },
  bar: {
    width: THEME.sizes.barWidth,
    backgroundColor: THEME.colors.barColor,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: THEME.colors.boardFrameInner,
    justifyContent: 'space-between',
    paddingVertical: 15,
    alignItems: 'center',
  },
  barCheckers: {
    gap: 2,
    alignItems: 'center',
  },
  bearOffArea: {
    width: THEME.sizes.bearOffWidth,
    backgroundColor: THEME.colors.bearOffBg,
    marginLeft: 4,
    justifyContent: 'space-between',
    paddingVertical: 8,
    alignItems: 'center',
    borderLeftWidth: 2,
    borderColor: THEME.colors.boardFrameInner,
  },
  bearOffBox: {
    alignItems: 'center',
    gap: 2,
  },
  bearOffLabel: {
    color: THEME.colors.textSecondary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  bearOffText: {
    color: THEME.colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 14,
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
  floatingChecker: {
    position: 'absolute',
    zIndex: 200,
    opacity: 0.85,
  },
});

export default Board;

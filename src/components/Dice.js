import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import THEME from '../constants/theme';
import { DICE_SPIN_MS } from '../utils/diceUtils';

// Atışın hangi anında zar yere değiyor (sürücünün 0-1 aralığında).
// Bu noktadan sonra gerçek değer görünür, kalan süre sekme ve oturmadır.
const LAND_AT = 0.62;

/**
 * Zar, tepsiye dışarıdan atılıyormuş gibi hareket eder: havada takla atarak
 * gelir, yere çarpar, kısa bir sekmeyle oturur. Yerinde dönmek yerine
 * gerçek bir atış hissi verir.
 *
 * Tüm hareket tek bir doğrusal sürücüden türetilir; hızlanma/yavaşlama
 * ara değerlerin dağılımıyla verilir, böylece uçuş ve sekme birbirine
 * tutarlı kalır.
 */
const Die = ({ value, isUsed, rolling, size = THEME.sizes.diceSize, from = 'right', delay = 0 }) => {
  const t = useRef(new Animated.Value(1)).current;   // 1 = durgun

  // Her atışta biraz farklı yörünge: iki zar birbirinin kopyası olmasın
  const shot = useRef({ dx: 0, dy: 0, spin: 720 });

  // Havadayken gerçek sonuç gizlenir; zar yere değince asıl değer görünür
  const [face, setFace] = useState(value);
  const [landed, setLanded] = useState(true);

  useEffect(() => {
    if (!rolling) {
      setFace(value);
      setLanded(true);
      t.setValue(1);
      return;
    }

    // Atış parametreleri
    const dir = from === 'left' ? -1 : 1;
    shot.current = {
      dx: dir * (size * 2.6 + Math.random() * size * 1.4),
      dy: -(size * 1.5 + Math.random() * size * 0.9),
      spin: 360 * (2 + Math.floor(Math.random() * 2)),   // 720 veya 1080: durgunken hep düz durur
    };

    setLanded(false);
    t.setValue(0);
    Animated.timing(t, {
      toValue: 1,
      duration: DICE_SPIN_MS,
      delay,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();

    // Havada yüzler hızla değişir
    let last = value;
    const cycle = setInterval(() => {
      let next;
      do { next = 1 + Math.floor(Math.random() * 6); } while (next === last);
      last = next;
      setFace(next);
    }, 60);

    // Yere değme anında sonuç kilitlenir
    const landTimer = setTimeout(() => {
      clearInterval(cycle);
      setLanded(true);
    }, delay + DICE_SPIN_MS * LAND_AT);

    return () => { clearInterval(cycle); clearTimeout(landTimer); };
  }, [rolling, value, size, from, delay, t]);

  const { dx, dy, spin } = shot.current;

  // Uçuş: dışarıdan gelir, LAND_AT'te tepsiye oturur
  const translateX = t.interpolate({
    inputRange: [0, LAND_AT, 1],
    outputRange: [dx, 0, 0],
  });
  // Yükseklik: yukarıdan düşer, çarpınca iki kez küçülerek seker
  const translateY = t.interpolate({
    inputRange: [0, 0.35, LAND_AT, 0.74, 0.85, 0.93, 1],
    outputRange: [dy, dy * 0.35, 0, -size * 0.28, 0, -size * 0.09, 0],
  });
  // Takla: havada hızlı, inişte yavaşlar
  const rotate = t.interpolate({
    inputRange: [0, LAND_AT, 1],
    outputRange: ['0deg', `${spin * 0.82}deg`, `${spin}deg`],
  });
  // Çarpma anında hafif ezilme, sonra toparlanma
  const scale = t.interpolate({
    inputRange: [0, 0.35, LAND_AT, 0.68, 0.85, 1],
    outputRange: [1.35, 1.18, 0.9, 1.06, 0.98, 1],
  });

  const dotSize = Math.max(size * 0.19, 4);

  if (!value) return null;

  const dotPositions = {
    1: [[0.5, 0.5]],
    2: [[0.2, 0.2], [0.8, 0.8]],
    3: [[0.2, 0.2], [0.5, 0.5], [0.8, 0.8]],
    4: [[0.2, 0.2], [0.2, 0.8], [0.8, 0.2], [0.8, 0.8]],
    5: [[0.2, 0.2], [0.2, 0.8], [0.5, 0.5], [0.8, 0.2], [0.8, 0.8]],
    6: [[0.2, 0.2], [0.2, 0.5], [0.2, 0.8], [0.8, 0.2], [0.8, 0.5], [0.8, 0.8]],
  };

  // Zar yere değene kadar gösterilen yüz gerçek sonuç değildir
  const shown = rolling && !landed ? face : value;
  const currentPositions = dotPositions[shown] || [];

  const animatedStyle = {
    transform: [
      { translateX },
      { translateY },
      { rotate },
      { scale },
    ],
    // Havadayken sönükleştirme yok: kullanılmış zar ipucu vermesin
    opacity: !rolling && isUsed ? 0.3 : 1,
  };

  return (
    <Animated.View style={[styles.die, { width: size, height: size, borderRadius: size * 0.2 }, animatedStyle]}>
      {currentPositions.map((pos, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              left: `${pos[0] * 100}%`,
              top: `${pos[1] * 100}%`,
              transform: [{ translateX: -dotSize / 2 }, { translateY: -dotSize / 2 }],
            },
          ]}
        />
      ))}
    </Animated.View>
  );
};

const Dice = ({ dice, rolling, remainingMoves, onRoll, size, from = 'right' }) => {
  if (!dice && onRoll) {
    return (
      <TouchableOpacity style={styles.rollButton} onPress={onRoll}>
        <Text style={styles.rollButtonText}>ZAR AT</Text>
      </TouchableOpacity>
    );
  }

  if (!dice) return null;

  let movesCopy = [...(remainingMoves || [])];

  const isUsed1 = dice[0] === dice[1] ? movesCopy.length < 4 : !movesCopy.includes(dice[0]);
  if (!isUsed1 && dice[0] !== dice[1]) {
    const idx = movesCopy.indexOf(dice[0]);
    if (idx > -1) movesCopy.splice(idx, 1);
  } else if (!isUsed1 && dice[0] === dice[1]) {
    movesCopy.pop();
  }

  const isUsed2 = dice[0] === dice[1] ? movesCopy.length < 3 : !movesCopy.includes(dice[1]);

  return (
    <View style={styles.container}>
      {/* İkinci zar hafif gecikmeyle atılır: tek parça gibi görünmesin */}
      <Die value={dice[0]} isUsed={isUsed1} rolling={rolling} size={size} from={from} />
      <Die value={dice[1]} isUsed={isUsed2} rolling={rolling} size={size} from={from} delay={90} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  die: {
    backgroundColor: THEME.colors.diceWhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    backgroundColor: THEME.colors.diceDots,
  },
  rollButton: {
    backgroundColor: THEME.colors.buttonPrimary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: THEME.colors.gold,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    elevation: 3,
  },
  rollButtonText: {
    color: THEME.colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
});

export default Dice;
export { Die };
